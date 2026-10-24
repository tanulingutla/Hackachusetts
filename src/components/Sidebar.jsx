import { NAV_GROUPS } from "../lib/nav.js";

// Left navigation. Grouped like a fitness app's menu. The active item is marked with a pink bar.
export default function Sidebar({ active, onSelect, userName }) {
  return (
    <aside className="sidebar" aria-label="Main navigation">
      <p className="brand sidebar-brand">why tho</p>

      <nav>
        {NAV_GROUPS.map((group) => (
          <div key={group.id} className="nav-group">
            {group.title && <p className="nav-title">{group.title}</p>}
            <ul>
              {group.items.map((item) => {
                const isActive = item.id === active;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={isActive ? "nav-item active" : "nav-item"}
                      aria-current={isActive ? "page" : undefined}
                      onClick={() => onSelect(item.id)}
                    >
                      <span>{item.label}</span>
                      {item.soon && <span className="soon-badge">Soon</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <p className="muted">{userName}</p>
      </div>
    </aside>
  );
}
