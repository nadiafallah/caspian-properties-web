// Test-only stand-in for https://app.cal.com/embed/embed.js.
// Consumes the official embed snippet's command queue, renders a fake booker with a
// "confirm" button and emits the same events as the real embed. No network, no bookings.
(function () {
  var Cal = window.Cal;
  var callbacks = {};

  function fire(action, data) {
    (callbacks[action] || []).forEach(function (cb) {
      cb({ detail: { data: data || {}, type: action, namespace: "stub" } });
    });
  }

  function handle(args) {
    var method = args[0];
    var arg = args[1];
    if (method === "on" && arg && arg.action) {
      (callbacks[arg.action] = callbacks[arg.action] || []).push(arg.callback);
    }
    if (method === "inline") {
      var root = typeof arg.elementOrSelector === "string" ? document.querySelector(arg.elementOrSelector) : arg.elementOrSelector;
      window.__calStub = { calLink: arg.calLink, config: arg.config };
      var button = document.createElement("button");
      button.type = "button";
      button.textContent = "Stub: confirm booking";
      button.setAttribute("data-testid", "cal-stub-book");
      button.onclick = function () {
        fire("bookingSuccessfulV2", { uid: "stub-booking", startTime: "2026-10-01T09:00:00.000Z", endTime: "2026-10-01T09:45:00.000Z" });
      };
      root.appendChild(button);
      setTimeout(function () {
        fire("linkReady");
      }, 50);
    }
  }

  function attach(api) {
    if (!api || api.__stubbed) return;
    var pending = api.q || [];
    api.q = { push: handle };
    api.__stubbed = true;
    for (var i = 0; i < pending.length; i++) handle(pending[i]);
  }

  var top = Cal.q || [];
  Cal.q = {
    push: function (args) {
      if (args[0] === "initNamespace") attach(Cal.ns[args[1]]);
    },
  };
  for (var i = 0; i < top.length; i++) {
    if (top[i][0] === "initNamespace") attach(Cal.ns[top[i][1]]);
  }
})();
