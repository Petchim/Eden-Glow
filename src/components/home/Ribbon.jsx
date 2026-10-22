import { DISCIPLINES } from '../../data/content.js';

/* The six disciplines from the shop banner, set as a quiet typographic band. */
export default function Ribbon() {
  return (
    <div className="ribbon" aria-label="Our disciplines">
      <ul className="wrap ribbon-in">
        {DISCIPLINES.map((d) => (
          <li key={d}>{d}</li>
        ))}
      </ul>
    </div>
  );
}
