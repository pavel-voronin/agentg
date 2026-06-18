# Trigger Dispatcher

- This folder owns procedure dispatch to configured module RPC targets.
- Dispatch treats action input as opaque JSON.
- Accepted or rejected provider results are domain results. Transport and
  protocol failures stay dispatch failures.
