import Badge from '../ui/Badge';
import { RISK_META } from '../../utils/constants';

export default function RiskBadge({ level, score }) {
  const meta = RISK_META[level] || { label: level || 'Unscored', tone: 'neutral' };
  const label =
    score === undefined || score === null
      ? meta.label
      : `${meta.label} · ${score}`;

  return <Badge tone={meta.tone}>{label}</Badge>;
}
