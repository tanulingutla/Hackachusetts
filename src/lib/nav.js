// Sidebar structure. Items marked soon open a placeholder until that feature is built.
export const NAV_GROUPS = [
  {
    id: "main",
    title: null,
    items: [
      { id: "home", label: "Home" },
      { id: "calendar", label: "Calendar" },
    ],
  },
  {
    id: "activities",
    title: "Activities",
    items: [
      { id: "activities", label: "Activities" },
      { id: "import", label: "Import data" },
    ],
  },
  {
    id: "health",
    title: "Health",
    items: [
      { id: "health", label: "Health Stats" },
      { id: "period", label: "Period" },
    ],
  },
  {
    id: "nutrition",
    title: "Nutrition",
    items: [
      { id: "nutrition", label: "Meals and targets" },
      { id: "rmr", label: "RMR" },
    ],
  },
  {
    id: "performance",
    title: "Performance",
    items: [{ id: "performance", label: "Performance Stats" }],
  },
  {
    id: "training",
    title: "Training and Planning",
    items: [{ id: "load", label: "Training load" }],
  },
  {
    id: "more",
    title: "More",
    items: [
      { id: "insights", label: "Insights" },
      { id: "reports", label: "Reports" },
      { id: "profile", label: "Profile" },
    ],
  },
];

export const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);
