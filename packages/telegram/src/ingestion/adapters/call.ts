import type { CallSavedChange, DomainChange } from '../../domain/changes.js';
import type { Call } from '../../domain/models/call.js';
import { tdJsonObject, type UpdateByType } from '../../tdlib/shape.js';

type CallUpdate = UpdateByType<'updateCall'>;
type TdlibCall = CallUpdate['call'];

export function callChanges(update: CallUpdate): DomainChange[] {
  return [
    {
      kind: 'call.saved',
      call: callRecord(update.call)
    } satisfies CallSavedChange
  ];
}

function callRecord(call: TdlibCall): Call {
  return {
    id: call.id,
    isOutgoing: call.is_outgoing,
    isVideo: call.is_video,
    state: tdJsonObject(call.state),
    uniqueId: call.unique_id,
    userId: String(call.user_id)
  };
}
