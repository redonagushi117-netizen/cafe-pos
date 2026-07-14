const { useState, useEffect, useCallback, useRef } = React;
const { Coffee, Plus, Minus, X, Check, RotateCcw, Settings, ArrowLeft, Receipt, TrendingUp, Download, Wifi, WifiOff } = lucide;

const STORAGE_KEY = "cafe-pos-data";
const TABLE_COUNT = 20;

const DEFAULT_MENU = [
  { id: "m1", name: "Makiato", price: 1.0, cost: 0.3 },
  { id: "m2", name: "Espresso", price: 0.8, cost: 0.25 },
  { id: "m3", name: "Kafe Turke", price: 1.0, cost: 0.3 },
  { id: "m4", name: "Kapuçino", price: 1.2, cost: 0.4 },
  { id: "m5", name: "Coca-Cola", price: 1.5, cost: 0.6 },
  { id: "m6", name: "Uje", price: 0.5, cost: 0.2 },
  { id: "m7", name: "Caj", price: 1.0, cost: 0.2 },
  { id: "m8", name: "Lemonade", price: 1.5, cost: 0.5 },
];

function defaultState() {
  return {
    menu: DEFAULT_MENU,
    tables: Array.from({ length: TABLE_COUNT }, (_, i) => ({
      id: i + 1,
      order: [],
      openedAt: null,
    })),
    transactions: [],
  };
}

function todayKey(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function money(n) {
  return n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function CafePOS() {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("tables");
  const [activeTable, setActiveTable] = useState(null);
  const [cashInput, setCashInput] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [summaryMode, setSummaryMode] = useState("tables");
  const [expandedTxId, setExpandedTxId] = useState(null);
  const [expandedTable, setExpandedTable] = useState(null);
  const [poppedItem, setPoppedItem] = useState(null);
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/Offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install
  useEffect(() => {
    const handler = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Shfaq promptin automatikisht pas 3 sekondash
      setTimeout(() => setShowInstallPrompt(true), 3000);
    };
    window.addEventListener('beforeinstallprompt', handler);
    
    // Kontrollo nëse është instaluar tashmë
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setShowInstallPrompt(false);
    }
    
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    setShowInstallPrompt(false);
  };

  useEffect(() => {
    const loadData = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setState(JSON.parse(stored));
        } else {
          setState(defaultState());
        }
      } catch (e) {
        setState(defaultState());
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const saveTimer = useRef(null);

  const persist = useCallback((next) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch (e) {
        console.error('Save error:', e);
      }
    }, 300);
  }, []);

  const updateState = useCallback(
    (updater) => {
      setState((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        persist(next);
        return next;
      });
    },
    [persist]
  );

  if (loading || !state) {
    return React.createElement('div', { className: "min-h-screen flex flex-col items-center justify-center bg-[#F3EFE4] gap-4" },
      React.createElement('div', { className: "relative w-16 h-16 flex items-end justify-center", style: { animation: "cupWobble 1.6s ease-in-out infinite" } },
        React.createElement(Coffee, { size: 48, className: "text-[#B8722E]", strokeWidth: 1.5 }),
        React.createElement('div', { className: "absolute bottom-1 left-1/2 -translate-x-1/2 w-6 h-4 bg-[#B8722E] rounded-b-md origin-bottom", style: { animation: "pourFill 1.4s ease-in-out infinite" } })
      ),
      React.createElement('div', { className: "text-[#7A6C5D] font-medium tracking-wide text-sm" }, "Duke ngarkuar...")
    );
  }

  const table = activeTable ? state.tables.find((t) => t.id === activeTable) : null;
  const orderLines = table
    ? table.order
        .map((line) => {
          const item = state.menu.find((m) => m.id === line.itemId);
          if (!item) return null;
          return { ...item, qty: line.qty };
        })
        .filter(Boolean)
    : [];
  const orderTotal = orderLines.reduce((s, l) => s + l.price * l.qty, 0);
  const cash = parseFloat(cashInput.replace(",", "."));
  const change = !isNaN(cash) ? cash - orderTotal : null;

  const today = todayKey(Date.now());
  const todaysTx = state.transactions.filter((t) => todayKey(t.ts) === today);
  const dayRevenue = todaysTx.reduce((s, t) => s + t.total, 0);
  const dayCost = todaysTx.reduce((s, t) => s + t.cost, 0);
  const dayProfit = dayRevenue - dayCost;

  const tableGroups = {};
  todaysTx.forEach((t) => {
    if (!tableGroups[t.tableId]) tableGroups[t.tableId] = [];
    tableGroups[t.tableId].push(t);
  });
  const sortedTableIds = Object.keys(tableGroups).map(Number).sort((a, b) => a - b);

  function openTable(id) {
    setActiveTable(id);
    setCashInput("");
    setView("order");
  }

  function addItem(itemId) {
    setPoppedItem({ id: itemId, key: Date.now() });
    updateState((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (t.id !== activeTable) return t;
        const existing = t.order.find((l) => l.itemId === itemId);
        const order = existing
          ? t.order.map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + 1 } : l))
          : [...t.order, { itemId, qty: 1 }];
        return { ...t, order, openedAt: t.openedAt || Date.now() };
      }),
    }));
  }

  function changeQty(itemId, delta) {
    updateState((prev) => ({
      ...prev,
      tables: prev.tables.map((t) => {
        if (t.id !== activeTable) return t;
        const order = t.order
          .map((l) => (l.itemId === itemId ? { ...l, qty: l.qty + delta } : l))
          .filter((l) => l.qty > 0);
        return { ...t, order };
      }),
    }));
  }

  function closePayment() {
    if (!table || orderLines.length === 0) return;
    const cost = orderLines.reduce((s, l) => s + l.cost * l.qty, 0);
    const tx = {
      id: `${Date.now()}`,
      tableId: table.id,
      items: orderLines.map((l) => ({ name: l.name, price: l.price, cost: l.cost, qty: l.qty })),
      total: orderTotal,
      cost,
      profit: orderTotal - cost,
      ts: Date.now(),
    };
    updateState((prev) => ({
      ...prev,
      transactions: [...prev.transactions, tx],
      tables: prev.tables.map((t) => (t.id === table.id ? { ...t, order: [], openedAt: null } : t)),
    }));
    setActiveTable(null);
    setCashInput("");
    setView("tables");
  }

  function resetDay() {
    updateState((prev) => ({
      ...prev,
      transactions: prev.transactions.filter((t) => todayKey(t.ts) !== today),
    }));
    setConfirmReset(false);
  }

  function updateMenuItem(id, field, value) {
    updateState((prev) => ({
      ...prev,
      menu: prev.menu.map((m) => (m.id === id ? { ...m, [field]: value } : m)),
    }));
  }

  function addMenuItem() {
    const id = `m${Date.now()}`;
    updateState((prev) => ({
      ...prev,
      menu: [...prev.menu, { id, name: "Produkt i ri", price: 1.0, cost: 0 }],
    }));
  }

  function removeMenuItem(id) {
    updateState((prev) => ({ ...prev, menu: prev.menu.filter((m) => m.id !== id) }));
  }

  return React.createElement('div', { className: "min-h-screen bg-[#F3EFE4] text-[#2B2118] relative overflow-x-hidden", style: { fontFamily: "'Inter', sans-serif" } },
    // Styles
    React.createElement('style', null, `
      @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700;900&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@500;600&display=swap');
      .font-display { font-family: 'Fraunces', serif; }
      .font-mono-num { font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums; }
      body { overscroll-behavior: none; -webkit-overflow-scrolling: touch; }
      * { -webkit-tap-highlight-color: transparent; }
      @keyframes pourFill { 0%, 100% { transform: scaleY(0.3); opacity: 0.5; } 50% { transform: scaleY(1); opacity: 1; } }
      @keyframes cupWobble { 0%, 100% { transform: rotate(-2deg); } 50% { transform: rotate(2deg); } }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes popFloat { 0% { transform: translateY(0) scale(0.6); opacity: 0; } 25% { opacity: 1; transform: translateY(-4px) scale(1.1); } 100% { transform: translateY(-26px) scale(1); opacity: 0; } }
      .pop-badge { position: absolute; top: -6px; right: 6px; font-family: 'JetBrains Mono', monospace; font-weight: 600; font-size: 11px; color: #3F6B5C; background: white; border: 1px solid #3F6B5C40; border-radius: 999px; padding: 1px 6px; animation: popFloat 0.7s ease-out forwards; pointer-events: none; }
      @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
    `),

    // Online/Offline badge
    !isOnline && React.createElement('div', { 
      className: "fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-orange-500 text-white px-4 py-2 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg",
      style: { animation: "slideDown 0.3s ease-out" }
    },
      React.createElement(WifiOff, { size: 16 }),
      "Mode Offline"
    ),

    // Install prompt
    showInstallPrompt && React.createElement('div', { className: "fixed top-16 left-4 right-4 z-50", style: { animation: "fadeInUp 0.3s ease-out" } },
      React.createElement('div', { className: "bg-gradient-to-r from-[#2B2118] to-[#3A2A1D] text-white rounded-2xl p-4 shadow-2xl flex items-center gap-3 max-w-md mx-auto" },
        React.createElement(Coffee, { size: 32, className: "text-[#C7936B]" }),
        React.createElement('div', { className: "flex-1" },
          React.createElement('div', { className: "font-semibold text-sm" }, "Instalo si Aplikacion"),
          React.createElement('div', { className: "text-xs opacity-80" }, "Punon offline, më shpejt & më lehtë!")
        ),
        React.createElement('button', {
          onClick: handleInstallClick,
          className: "bg-[#C7936B] text-[#2B2118] px-4 py-2 rounded-xl text-sm font-semibold active:scale-95 transition flex items-center gap-1"
        },
          React.createElement(Download, { size: 16 }),
          " Instalo"
        ),
        React.createElement('button', {
          onClick: () => setShowInstallPrompt(false),
          className: "p-1 opacity-60 hover:opacity-100"
        },
          React.createElement(X, { size: 18 })
        )
      )
    ),

    // Header
    React.createElement('div', { className: "sticky top-0 z-10 bg-[#F3EFE4]/95 backdrop-blur border-b border-[#E1D6C2] px-4 py-3 flex items-center justify-between" },
      React.createElement('div', { className: "flex items-center gap-2" },
        view !== "tables" && React.createElement('button', {
          onClick: () => { setView("tables"); setActiveTable(null); },
          className: "p-2 -ml-2 rounded-full hover:bg-[#E9E0CE] active:scale-95 transition"
        }, React.createElement(ArrowLeft, { size: 20 })),
        React.createElement(Coffee, { size: 22, className: "text-[#B8722E]" }),
        React.createElement('h1', { className: "font-display text-lg font-semibold tracking-tight" },
          view === "tables" ? "Tavolinat" :
          view === "order" ? `Tavolina ${activeTable}` :
          view === "summary" ? "Përmbledhja" : "Menuja"
        )
      ),
      React.createElement('div', { className: "flex items-center gap-1" },
        React.createElement('button', {
          onClick: () => setView("summary"),
          className: `p-2 rounded-full transition ${view === "summary" ? "bg-[#2B2118] text-white" : ""}`
        }, React.createElement(TrendingUp, { size: 20 })),
        React.createElement('button', {
          onClick: () => setView("menu"),
          className: `p-2 rounded-full transition ${view === "menu" ? "bg-[#2B2118] text-white" : ""}`
        }, React.createElement(Settings, { size: 20 }))
      )
    ),

    // Main content
    React.createElement('div', { className: "p-4 max-w-2xl mx-auto pb-24" },
      view === "tables" && React.createElement('div', null,
        React.createElement('div', { className: "grid grid-cols-2 gap-3 mb-4" },
          React.createElement('div', { className: "bg-white rounded-xl border border-[#E1D6C2] p-3" },
            React.createElement('div', { className: "text-[10px] uppercase tracking-wide text-[#7A6C5D]" }, "Pazari i sotëm"),
            React.createElement('div', { className: "font-mono-num text-lg font-semibold" }, `${money(dayRevenue)} €`)
          ),
          React.createElement('div', { className: "bg-white rounded-xl border border-[#E1D6C2] p-3" },
            React.createElement('div', { className: "text-[10px] uppercase tracking-wide text-[#7A6C5D]" }, "Fitimi i sotëm"),
            React.createElement('div', { className: "font-mono-num text-lg font-semibold text-[#3F6B5C]" }, `${money(dayProfit)} €`)
          )
        ),
        React.createElement('div', { className: "grid grid-cols-4 gap-3" },
          state.tables.map((t) => {
            const lines = t.order.reduce((s, l) => {
              const item = state.menu.find((m) => m.id === l.itemId);
              return s + (item ? item.price * l.qty : 0);
            }, 0);
            const occupied = t.order.length > 0;
            return React.createElement('button', {
              key: t.id,
              onClick: () => openTable(t.id),
              className: `aspect-square rounded-2xl border-2 flex flex-col items-center justify-center gap-1 active:scale-90 transition ${
                occupied ? "bg-gradient-to-br from-[#A63D40]/12 to-[#A63D40]/5 border-[#A63D40] text-[#A63D40]" : 
                "bg-gradient-to-br from-white to-[#FAF7EF] border-[#3F6B5C]/35 text-[#3F6B5C]"
              }`
            },
              React.createElement('span', { className: "font-display text-xl font-bold" }, t.id),
              occupied ? 
                React.createElement('span', { className: "font-mono-num text-[11px]" }, money(lines)) :
                React.createElement('span', { className: "text-[10px] uppercase opacity-70" }, "lirë")
            );
          })
        )
      ),

      view === "order" && table && React.createElement('div', { className: "space-y-5" },
        React.createElement('div', { className: "grid grid-cols-2 gap-2" },
          state.menu.map((item) => React.createElement('button', {
            key: item.id,
            onClick: () => addItem(item.id),
            className: "relative bg-white rounded-xl border border-[#E1D6C2] p-3 text-left active:scale-95 transition"
          },
            poppedItem && poppedItem.id === item.id && React.createElement('span', {
              key: poppedItem.key,
              className: "pop-badge",
              onAnimationEnd: () => setPoppedItem(null)
            }, "+1"),
            React.createElement('div', { className: "font-medium text-sm" }, item.name),
            React.createElement('div', { className: "font-mono-num text-[#B8722E] text-sm mt-0.5" }, `${money(item.price)} €`)
          ))
        ),
        React.createElement('div', { className: "bg-white rounded-2xl border border-[#E1D6C2] p-4 shadow-sm" },
          React.createElement('div', { className: "flex items-center gap-2 mb-3 text-[#7A6C5D]" },
            React.createElement(Receipt, { size: 16 }),
            React.createElement('span', { className: "text-xs uppercase tracking-widest font-medium" }, "Porosia")
          ),
          orderLines.length === 0 ? 
            React.createElement('p', { className: "text-sm text-[#7A6C5D] italic" }, "Shto artikuj nga menuja lart.") :
            React.createElement('div', { className: "space-y-2 font-mono-num text-sm" },
              orderLines.map((l) => React.createElement('div', { key: l.id, className: "flex items-center justify-between" },
                React.createElement('span', { className: "font-sans flex-1" }, l.name),
                React.createElement('div', { className: "flex items-center gap-2" },
                  React.createElement('button', {
                    onClick: () => changeQty(l.id, -1),
                    className: "w-6 h-6 rounded-full bg-[#F3EFE4] flex items-center justify-center active:scale-90"
                  }, React.createElement(Minus, { size: 12 })),
                  React.createElement('span', { className: "w-4 text-center" }, l.qty),
                  React.createElement('button', {
                    onClick: () => changeQty(l.id, 1),
                    className: "w-6 h-6 rounded-full bg-[#F3EFE4] flex items-center justify-center active:scale-90"
                  }, React.createElement(Plus, { size: 12 }))
                ),
                React.createElement('span', { className: "w-16 text-right" }, `${money(l.price * l.qty)} €`)
              )),
              React.createElement('div', { className: "border-t border-dashed border-[#D8CDBB] pt-2 mt-2 flex justify-between font-semibold text-base" },
                React.createElement('span', { className: "font-sans" }, "Total"),
                React.createElement('span', null, `${money(orderTotal)} €`)
              )
            )
        ),
        orderLines.length > 0 && React.createElement('div', { className: "bg-white rounded-2xl border border-[#E1D6C2] p-4 space-y-3" },
          React.createElement('label', { className: "text-xs uppercase tracking-widest font-medium text-[#7A6C5D]" }, "Cash i marrë (€)"),
          React.createElement('input', {
            inputMode: "decimal",
            value: cashInput,
            onChange: (e) => setCashInput(e.target.value),
            placeholder: money(orderTotal),
            className: "w-full font-mono-num text-xl border border-[#E1D6C2] rounded-xl px-3 py-2 focus:outline-none focus:border-[#B8722E]"
          }),
          change !== null && !isNaN(change) && React.createElement('div', {
            className: `font-mono-num text-lg font-semibold ${change < 0 ? "text-[#A63D40]" : "text-[#3F6B5C]"}`
          }, change < 0 ? `Mungon ${money(Math.abs(change))} €` : `Kusuri: ${money(change)} €`),
          React.createElement('button', {
            onClick: closePayment,
            disabled: change !== null && change < 0,
            className: "w-full bg-gradient-to-b from-[#3A2A1D] to-[#2B2118] text-white rounded-xl py-3 font-medium flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
          },
            React.createElement(Check, { size: 18 }),
            " Mbyll tavolinën"
          )
        )
      ),

      view === "summary" && React.createElement('div', { className: "space-y-4" },
        React.createElement('div', { className: "bg-gradient-to-br from-[#2B2118] to-[#3A2A1D] text-white rounded-2xl p-5" },
          React.createElement('div', { className: "text-xs uppercase opacity-70 mb-1" }, `Sot, ${today}`),
          React.createElement('div', { className: "grid grid-cols-2 gap-4 mt-3" },
            React.createElement('div', null,
              React.createElement('div', { className: "text-[11px] uppercase opacity-60" }, "Hyrje"),
              React.createElement('div', { className: "font-mono-num text-2xl font-semibold" }, `${money(dayRevenue)} €`)
            ),
            React.createElement('div', null,
              React.createElement('div', { className: "text-[11px] uppercase opacity-60" }, "Fitimi"),
              React.createElement('div', { className: "font-mono-num text-2xl font-semibold text-[#C7936B]" }, `${money(dayProfit)} €`)
            )
          ),
          React.createElement('div', { className: "text-xs opacity-60 mt-3" }, `${todaysTx.length} porosi të mbyllura`)
        ),
        todaysTx.length > 0 && React.createElement('button', {
          onClick: () => setConfirmReset(true),
          className: "w-full flex items-center justify-center gap-2 text-[#A63D40] text-sm py-2"
        },
          React.createElement(RotateCcw, { size: 14 }),
          " Fillo ditë të re"
        ),
        confirmReset && React.createElement('div', { className: "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-20" },
          React.createElement('div', { className: "bg-white rounded-2xl p-5 max-w-sm w-full space-y-3" },
            React.createElement('p', { className: "font-medium" }, "Të fshihen të gjitha shënimet e sotme?"),
            React.createElement('div', { className: "flex gap-2 pt-2" },
              React.createElement('button', {
                onClick: () => setConfirmReset(false),
                className: "flex-1 py-2 rounded-xl border border-[#E1D6C2]"
              }, "Anulo"),
              React.createElement('button', {
                onClick: resetDay,
                className: "flex-1 py-2 rounded-xl bg-[#A63D40] text-white"
              }, "Fshi")
            )
          )
        )
      ),

      view === "menu" && React.createElement('div', { className: "space-y-3" },
        React.createElement('p', { className: "text-sm text-[#7A6C5D]" }, "Vendos çmimin dhe koston për secilin artikull."),
        state.menu.map((item) => React.createElement('div', {
          key: item.id,
          className: "bg-white rounded-xl border border-[#E1D6C2] p-3 flex items-center gap-2"
        },
          React.createElement('input', {
            value: item.name,
            onChange: (e) => updateMenuItem(item.id, "name", e.target.value),
            className: "flex-1 min-w-0 border-b border-transparent focus:border-[#B8722E] outline-none text-sm font-medium"
          }),
          React.createElement('div', { className: "flex flex-col items-end" },
            React.createElement('label', { className: "text-[9px] uppercase text-[#7A6C5D]" }, "Çmimi"),
            React.createElement('input', {
              inputMode: "decimal",
              value: item.price,
              onChange: (e) => updateMenuItem(item.id, "price", parseFloat(e.target.value) || 0),
              className: "w-16 font-mono-num text-sm text-right border-b border-[#E1D6C2] focus:border-[#B8722E] outline-none"
            })
          ),
          React.createElement('div', { className: "flex flex-col items-end" },
            React.createElement('label', { className: "text-[9px] uppercase text-[#7A6C5D]" }, "Kosto"),
            React.createElement('input', {
              inputMode: "decimal",
              value: item.cost,
              onChange: (e) => updateMenuItem(item.id, "cost", parseFloat(e.target.value) || 0),
              className: "w-16 font-mono-num text-sm text-right border-b border-[#E1D6C2] focus:border-[#B8722E] outline-none"
            })
          ),
          React.createElement('button', {
            onClick: () => removeMenuItem(item.id),
            className: "p-1.5 text-[#A63D40]"
          }, React.createElement(X, { size: 16 }))
        )),
        React.createElement('button', {
          onClick: addMenuItem,
          className: "w-full border-2 border-dashed border-[#D8CDBB] rounded-xl py-3 text-[#7A6C5D] text-sm flex items-center justify-center gap-2"
        },
          React.createElement(Plus, { size: 16 }),
          " Shto artikull"
        )
      )
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(React.createElement(CafePOS));