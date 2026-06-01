# Events Content

- This folder contains Control Plane UI content for the event stream.
- Do not call module procedures from lifecycle hooks, timers, or event handlers
  without direct user intent.
- Keep browser-only view logic here; server and registry code stays outside.
