# Контракт сервиса политик

## Назначение

`policies` дает агенту единый API для изменения активных деклараций поведения, а
модулям дает `usePolicy(...)`, который возвращает getter текущего тела политики
без metadata, YAML, RPC, подписок и файловых путей.

Политики являются infrastructure capability framework-а. Они не являются доменом
Telegram, History Sync, Dashboard или другого модуля.

## Цель

Сделать центральный механизм политик, который:

- хранит активные YAML instances;
- валидирует `spec` через `zod`-формы, объявленные в модулях;
- собирает итоговое policy value через resolver;
- уведомляет работающие модули об изменении policy value;
- скрывает от доменного кода storage, YAML parsing, RPC и events;
- дает разработчику простую поверхность: `definePolicy(...)` и
  `usePolicy(...)`.

## Не цели

- Не строить аудит-хранилище изменений. На первом этапе достаточно логов.
- Не вводить метрики и Dashboard до стабилизации контракта.
- Не делать DB-хранилище первым срезом.
- Не делать API политик внутри каждого доменного модуля.
- Не применять изменения к уже запущенным jobs.

## Принятые решения

- Source of truth: YAML instances в `PolicyStore`.
- Catalog: generated catalog принадлежит endpoint composition layer, не
  framework source.
- Resolve: выполняется server-side до записи в store.
- Consumption: модуль читает только policy value через `usePolicy(...)`.
- Runtime value: `usePolicy(...)` возвращает stable getter актуального readonly
  snapshot.
- Empty store: active set `[]` передается в resolver.
- Endpoint: API управления меняет instances, API исполнения отдает готовое value.

## Инварианты

- Raw YAML существует только на границе store/endpoint input; после parsing
  система работает с `PolicyDocument`.
- Resolver получает только валидные `spec`, без `metadata`.
- `metadata` используется для identity, поиска, порядка и управления.
- Store mutation происходит только после успешной validation и resolver.
- Consuming module получает только policy value.
- Policy value должен быть JSON-serializable plain object/array.

## Ownership

Клиентская и серверная реализация политик живет во framework.

```text
@agentg/framework/policies
  definePolicy(...)
  usePolicy(...)
  resolver helpers
  createPolicyServer(...)
  createPolicyClient(...)

@agentg/policies
  infrastructure endpoint contract
  endpoint procedure names
  endpoint wire types
  endpoint process composition
```

`@agentg/policies` не является доменным модулем и не содержит module DX. Он
существует только как endpoint boundary и composition entrypoint. Реализация
client/server живет во framework; endpoint process вызывает ее как factory.

Generated catalog не живет внутри framework source, если он импортирует module
policy entrypoints. Catalog принадлежит composition layer:

```ts
createPolicyServer({ catalog, store });
```

Модули импортируют policy DX из framework subpath:

```ts
import { collectSpecs, definePolicy, recordBy } from '@agentg/framework/policies';
```

Root exports остаются минимальными. Policy helpers не расширяют package root без
текущего внешнего consumer-а.

## Главное противоречие

Агенту нужны маленькие независимые YAML-декларации, но коду модуля нужен простой
текущий объект или массив, с которым можно работать как с обычным TypeScript.

Решение: policy server хранит и валидирует instances, собирает итоговое policy
value, а `usePolicy(definition)` возвращает consuming module-у getter этого
value.

## Как это работает

1. Модуль объявляет `definePolicy(...)`: `kind`, `moduleId`, `version`,
   `zod`-форму `spec` и resolver.
2. Build-time catalog собирает definitions из модулей.
3. Composition layer запускает endpoint и передает catalog во framework:
   `createPolicyServer({ catalog, store })`.
4. Агент через единый endpoint создает, обновляет или удаляет YAML instance.
5. Policy server находит definition по `kind`.
6. Policy server валидирует `spec` измененного документа.
7. Policy server строит новый active set для этого `kind`.
8. Policy server выполняет resolver для всего active set.
9. Если validation или resolver завершились ошибкой, документ не сохраняется.
10. Если новое policy value построено, server сохраняет документ и публикует
    `policies.instances.changed`.
11. `usePolicy(definition)` получает событие и refetches готовое policy value.
12. Код модуля вызывает getter и читает объект или массив, который вернул
    resolver.

Мета документа не попадает в consuming module: он уже выбрал конкретную policy
definition.

## PolicyDefinition

Definition живет в модуле, который владеет смыслом политики.

```ts
// packages/foobar/policies/policies.ts
import { z } from 'zod';
import { collectSpecs, definePolicy } from '@agentg/framework/policies';

export const foobarRulesPolicy = definePolicy({
  id: 'foobar.rules',
  kind: 'FoobarRule',
  moduleId: 'foobar',
  version: 1,

  spec: z.object({
    target: z.string(),
    mode: z.enum(['enabled', 'disabled']),
    limit: z.number().int().positive().nullable()
  }),

  resolve: collectSpecs()
});

export const foobarSettingsPolicy = definePolicy({
  id: 'foobar.settings',
  kind: 'FoobarSetting',
  moduleId: 'foobar',
  version: 1,

  spec: z.object({
    key: z.string(),
    value: z.string()
  }),

  resolve(specs) {
    return Object.fromEntries(specs.map((spec) => [spec.key, spec.value]));
  }
});

export const policies = [foobarRulesPolicy, foobarSettingsPolicy] as const;
```

### Поля definition

`id` — стабильный developer-facing id definition. Нужен для catalog, диагностики,
form metadata и уникальности definition. Это не identity YAML instance.

`kind` — тип policy-документа. По нему YAML instance связывается с definition.
Это главный ключ выбора validator/resolver.

`moduleId` — владелец смысла политики. Нужен для discovery, фильтрации,
ownership и event routing. Это не доменный API модуля.

`version` — версия контракта `spec` и resolver для этого `kind`. Нужна для
catalog diagnostics и form cache invalidation.

`spec` — `zod`-форма тела YAML-документа. Из нее берется validation и
TypeScript-тип `Spec`.

`resolve` — plain function, которая строит итоговое policy value из массива
валидных `spec`. Тип policy value выводится из return type этой функции.
TypeScript требует top-level object/array, а runtime framework проверяет, что
результат является JSON-safe object/array.

Policy entrypoint должен быть pure: без database, events, TDLib, module setup,
RPC clients и других side effects.

## Resolver helpers

Resolver — это функция сборки итогового policy value из всех active `spec`
одного `kind`.

Если `resolve` не задан, framework применяет resolver по умолчанию:

```ts
resolve: collectSpecs();
```

`collectSpecs` возвращает все `spec` в детерминированном порядке. Базовый порядок
задает infrastructure по `metadata.name`. Если политике нужен приоритет, он
должен быть полем `spec`, а не `metadata`.

Стартовые helpers являются обычными resolver functions:

```ts
collectSpecs();
recordBy((spec) => spec.key);
singleSpec({ empty: emptySpec });
```

`recordBy` отклоняет duplicate key как resolver error. `singleSpec` возвращает
единственный `spec`, использует `empty` при `[]` и отклоняет больше одного
instance как resolver error.

Можно написать custom resolver:

```ts
resolve(specs) {
  return Object.fromEntries(specs.map((spec) => [spec.key, spec.value]));
}
```

Generic YAML merge запрещен. Каждый `kind` сам задает семантику объединения
через resolver.

Resolver выполняется на стороне policy server. Это значит:

- невалидная композиция не попадает в store;
- `setInstance` честно отвечает агенту, применима политика или нет;
- все consumers получают одно и то же policy value;
- `usePolicy` остается live-cache adapter;
- resolver обязан быть pure и deterministic.

Если модулю нужен богатый helper, он строит его у себя поверх plain policy value.

## PolicyInstance

Один активный YAML-документ. Это не журнал намерений, а текущее декларативное
состояние.

```yaml
apiVersion: agentg.dev/v1
kind: FoobarRule
metadata:
  name: alphaEnabled
  labels:
    area: demo
spec:
  target: alpha
  mode: enabled
  limit: 10
```

### Поля instance

`apiVersion` — версия envelope-формата policy document. Это не версия доменного
`spec`. Первый контракт: `agentg.dev/v1`.

`kind` — выбирает `PolicyDefinition`. Значение должно совпасть с
`definition.kind`.

`metadata` — служебная оболочка для хранения и управления. В `usePolicy` она не
попадает.

`metadata.name` — имя instance внутри `kind`. Вместе с `kind` образует identity:
`kind + metadata.name`.

`metadata.labels` — управленческая таксономия для поиска, фильтрации и UI. В
policy value она не попадает.

Labels являются `Record<string, string>`. Ключи должны быть camelCase, значения
должны быть непустыми строками.

`spec` — тело политики. Оно валидируется через `definition.spec` и передается в
resolver.

Правила identity:

- `kind + metadata.name` должен быть уникален во всем store;
- `metadata.name` должен быть camelCase stem, совместимый с именем файла;
- file adapter хранит документ по canonical path, выведенному из identity;
- mismatch между path и identity при старте является ошибкой store;
- duplicate identity при старте является ошибкой store.

## Policy value

Policy value — это то, что возвращает getter из `usePolicy`.

Для `foobarRulesPolicy` с default resolver:

```ts
const getRules = usePolicy(foobarRulesPolicy);
```

`getRules` типизирован как getter:

```ts
() => readonly {
  target: string;
  mode: 'enabled' | 'disabled';
  limit: number | null;
}[]
```

Для `foobarSettingsPolicy` с custom resolver:

```ts
const getSettings = usePolicy(foobarSettingsPolicy);
```

`getSettings` типизирован как getter:

```ts
() => Readonly<Record<string, string>>;
```

Доменный код не получает `apiVersion`, `kind`, `metadata`, `moduleId` или
`policyId`, потому что он уже работает внутри конкретной политики.

Пустой валидный store является допустимым состоянием:

- `collectSpecs()` возвращает пустой readonly-массив;
- custom resolver получает `[]`;
- если policy не может работать без instance, custom resolver обязан явно
  бросить ошибку на `[]`.

## Endpoint API

Endpoint package `@agentg/policies` описывает контракт обмена. API управления
предназначен для agent/operator edge. API исполнения предназначен для framework
policy client. Доменные модули не вызывают endpoint напрямую.

### API управления

```ts
listPolicyKinds(): readonly PolicyKindDescriptor[];
listInstances(input: { kind?: string; moduleId?: string; labels?: Record<string, string> }): readonly PolicyDocument[];
getInstance(input: PolicyIdentity): PolicyDocument;
setInstance(input: { document: PolicyDocument }): PolicyMutationResult;
deleteInstance(input: PolicyIdentity): PolicyMutationResult;
```

`listPolicyKinds()` возвращает `kind`, `moduleId`, `version`, `id` и `form`. Он не
возвращает resolver или module-local типы.

`setInstance` валидирует документ через `spec`, строит новый active set,
выполняет resolver и только после этого сохраняет документ. `deleteInstance`
делает то же самое для active set без удаляемого документа.

`setInstance` и `deleteInstance` в первом срезе являются single-instance
операциями; batch update не входит в первый контракт.

### API исполнения

```ts
getPolicyValue(input: { kind: string }): PolicyValue;
```

`getPolicyValue({ kind })` возвращает готовое policy value для framework
`usePolicy(...)`.

### Wire-типы

```ts
type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
type PolicyValue = readonly JsonValue[] | { readonly [key: string]: JsonValue };

type PolicyIdentity = { kind: string; name: string };

type PolicyDocument = {
  apiVersion: 'agentg.dev/v1';
  kind: string;
  metadata: { name: string; labels?: Record<string, string> };
  spec: JsonValue;
};

type PolicyKindDescriptor = {
  id: string;
  kind: string;
  moduleId: string;
  version: number;
  form: { spec: JsonValue; examples?: readonly PolicyDocument[] };
};

type PolicyErrorCode =
  | 'unknown_kind'
  | 'invalid_api_version'
  | 'invalid_document'
  | 'invalid_spec'
  | 'resolver_error'
  | 'non_json_value'
  | 'duplicate_identity'
  | 'path_identity_mismatch'
  | 'store_conflict';

type PolicyError = {
  code: PolicyErrorCode;
  message: string;
  identity?: PolicyIdentity;
  fieldPath?: readonly string[];
};

type PolicyMutationResult =
  | {
      status: 'applied';
      operation: 'set' | 'delete';
      identity: PolicyIdentity;
      policyValueChanged: boolean;
    }
  | {
      status: 'rejected';
      operation: 'set' | 'delete';
      identity?: PolicyIdentity;
      policyValueChanged: false;
      error: PolicyError;
    };
```

`PolicyMutationResult` является прямым результатом команды, а не compatibility
envelope. Transport/protocol failures остаются RPC errors; ожидаемые отказы
policy contract возвращаются как `status: 'rejected'`.

## Failure model

- Invalid mutation возвращает `status: 'rejected'` и не меняет store.
- Transport/protocol failures возвращаются как RPC errors.
- Policy server до открытия endpoint загружает store, валидирует instances и
  строит policy value для каждого known `kind`.
- Startup policy server падает при unreadable file, invalid YAML, unknown kind,
  invalid spec, resolver error, duplicate identity или path/identity mismatch.
- Startup consumer не падает из-за отсутствия instances.
- Startup consumer падает при недоступном endpoint или ошибке `getPolicyValue`.
- После успешного startup `usePolicy` сохраняет last-good value при refetch
  failure.
- Event publish failure не откатывает уже примененный store write; результат
  остается `applied`, ошибка пишется в лог, consumers обновятся после следующего
  успешного события или рестарта.

## API потребления внутри модуля

Модуль получает текущее тело политики через `usePolicy(definition)`.
Доменный код не создает `policiesClient`, не подписывается на events, не читает
YAML и не выполняет resolver.

```ts
// packages/foobar/src/module.ts
import { foobarRulesPolicy, foobarSettingsPolicy } from '../policies/policies.js';

export const foobarModule = defineModule('foobar', {
  config: readConfig,

  setup({ resource, usePolicy }) {
    const getRules = usePolicy(foobarRulesPolicy);
    const getSettings = usePolicy(foobarSettingsPolicy);

    const foobar = resource('foobar', () =>
      createFoobar({
        getRules,
        getSettings
      })
    );

    return {
      getFoobar: getFoobarProcedure({ foobar })
    };
  }
});
```

В доменном коде это выглядит как обычный объект или массив:

```ts
// packages/foobar/src/foobar.ts
type FoobarOptions = {
  getRules: () => readonly FoobarRuleSpec[];
  getSettings: () => Readonly<Record<string, string>>;
};

export function createFoobar(options: FoobarOptions) {
  return {
    modeFor(target: string): 'enabled' | 'disabled' {
      return options.getRules().find((rule) => rule.target === target)?.mode ?? 'disabled';
    },

    setting(key: string): string | undefined {
      return options.getSettings()[key];
    }
  };
}
```

`usePolicy` возвращает live getter: сама функция стабильна, а каждый вызов
читает актуальный policy snapshot. После update следующий вызов `getRules()` или
`getSettings()` видит новые данные.

Первый срез поддерживает только object/array policy values. Сохраненный результат
вызова getter является snapshot; чтобы увидеть update, код вызывает getter
заново. Snapshot readonly, runtime mutation отклоняется через frozen value.

Контракт `usePolicy(definition)`:

- возвращает getter типа `() => PolicyValueOf<typeof definition>`;
- при omitted `resolve` этот тип соответствует результату `collectSpecs()`;
- до успешного startup чтение значения бросает ошибку разработки;
- регистрирует startup process во framework module setup;
- на startup делает `getPolicyValue({ kind })`;
- на update заново делает `getPolicyValue({ kind })`;
- атомарно заменяет latest snapshot;
- при update/refetch error оставляет last-good value и логирует ошибку;
- не пересчитывает уже запущенные jobs.

## Доставка обновлений

Событие `policies.instances.changed` не содержит сами instances и не содержит
policy value.

```ts
type PolicyInstancesChanged = {
  kind: string;
  moduleId: string;
};
```

`usePolicy(definition)` на событие:

1. игнорирует событие с чужим `kind`;
2. делает `getPolicyValue({ kind: definition.kind })`;
3. атомарно заменяет latest snapshot.

Если refetch завершился ошибкой, `usePolicy` оставляет last-good value, логирует
ошибку и не валит consumer после успешного startup. Event bus не является source
of truth. После рестарта модуль всегда получает актуальное policy value через
endpoint.

## PolicyStore

Устойчивое хранилище экземпляров. Первый adapter — файловый:

```text
config/policies/foobar-rule/alphaEnabled.yaml
config/policies/foobar-rule/betaDisabled.yaml
```

Файловая структура нужна только человеку и adapter-у. API должен запрашивать по
`kind`, `moduleId`, `metadata.name`, `labels`, а не по пути.

Adapter contract:

```ts
type PolicyStore = {
  loadAll(): Promise<readonly PolicyInstanceDocument[]>;
  set(document: PolicyInstanceDocument): Promise<void>;
  delete(identity: PolicyInstanceIdentity): Promise<void>;
};
```

Файловый adapter:

- пишет только canonical path;
- заменяет файл атомарно через temp-файл в той же директории и rename;
- чистит незавершенные temp-файлы на старте;
- удаляет по identity, а не по произвольному path;
- не открывает path-based API наружу.

## Discovery definitions

Definitions объявляются в модулях:

```text
packages/telegram/policies/policies.ts
packages/history-sync/policies/policies.ts
packages/foobar/policies/policies.ts
```

Catalog генерируется build-time из `packages/*/policies/policies.ts`.
Generated catalog принадлежит composition layer:

```text
packages/policies/src/generated/policyCatalog.ts
```

Generated catalog не редактируется вручную. Он импортирует только policy
entrypoints, не package root доменных модулей и не module runtime/resources.

Composition layer запускает endpoint:

```ts
createPolicyServer({ catalog, store });
```

Catalog invariants:

- `definition.id` должен быть глобально уникален;
- `definition.kind` должен быть глобально уникален;
- duplicate definitions валят generation/startup.

## Первый потребитель

Первый потребитель — Telegram files: policy value заменяет зашитые таблицы
правил, а защитные проверки и правила выбора поведения остаются в доменном коде.

## Правила применения

- Изменение политики влияет только на новые операции.
- Невалидное обновление не меняет активное policy value.
- Логи фиксируют успешные и отклоненные изменения.
- Mutations выполняются последовательно.

## Первый срез реализации

1. Добавить `packages/framework/src/policies/**`: `definePolicy`, resolver
   helpers, `createPolicyServer`, `createPolicyClient`, `usePolicy`
   integration.
2. Добавить `packages/policies`: endpoint process, composition entrypoint и
   generated catalog.
3. Сделать файловый `PolicyStore`.
4. Сделать build-time generator для `packages/*/policies/policies.ts`.
5. Добавить `@agentg/framework/policies` subpath export.
6. Добавить `usePolicy(definition)` в framework module setup.
7. Перенести первые зашитые правила в YAML instances.
8. Подключить `usePolicy(...)` в первом consuming module.

## Тестовый контракт

- invalid YAML/spec не меняет active instances;
- resolver error не меняет active instances;
- non-JSON policy value отклоняется как `non_json_value`;
- duplicate identity валит startup policy server;
- duplicate `definition.id` или `definition.kind` валит generation/startup;
- path/identity mismatch валит startup file adapter;
- endpoint wire types возвращают structured `PolicyError`;
- `setInstance` валидирует spec и resolver перед записью;
- `deleteInstance` валидирует resolver перед удалением;
- rejected mutation возвращает `status: 'rejected'` и не меняет store;
- `setInstance` пишет canonical path атомарно;
- `listInstances({ kind })` возвращает валидные active instances;
- `getPolicyValue({ kind })` возвращает resolved policy value;
- event содержит только `{ kind, moduleId }`;
- `usePolicy(definition)` refetches policy value по событию;
- `usePolicy(definition)` возвращает getter `() => PolicyValueOf<typeof definition>`;
- `usePolicy(definition)` сохраняет identity getter после update;
- getter возвращает latest snapshot после update;
- refetch failure сохраняет last-good value;
- foreign event ignored;
- omitted `resolve` использует `collectSpecs()`;
- empty store дает пустой массив для `collectSpecs()`;
- empty store вызывает custom resolver с `[]`;
- `recordBy` отклоняет duplicate key;
- `singleSpec` отклоняет больше одного instance;
- чтение policy value до успешного startup бросает ошибку разработки;
- startup consumer не падает без initial instances;
- отсутствие policies endpoint-а валит startup/configuration;
- доменный код не создает `policiesClient` и не подписывается на policy events
  вручную;
- consuming module не парсит YAML, не знает файловые пути и не выполняет
  resolver.
