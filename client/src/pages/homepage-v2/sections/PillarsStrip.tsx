import { objectIcon } from "../content";

const PILLARS = [
  { icon: "shield", title: "Cybersecurity first", text: "We secure your business from the inside out." },
  { icon: "bell", title: "Proactive IT", text: "Prevent issues before they impact your business." },
  { icon: "clipboard", title: "Compliance ready", text: "Stay aligned with industry standards and regulations." },
  { icon: "building", title: "Local & responsive", text: "Arizona-based team, here when you need us." },
];

export function PillarsStrip(): JSX.Element {
  return (
    <div className="pillars">
      <div className="wrap grid g4">
        {PILLARS.map((pillar) => (
          <div className="item" key={pillar.title}>
            <img src={objectIcon(pillar.icon)} alt="" />
            <div>
              <h3>{pillar.title}</h3>
              <p>{pillar.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
