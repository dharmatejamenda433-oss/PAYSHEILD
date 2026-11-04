import Badge from '../ui/Badge';
import { STATUS_META } from '../../utils/constants';

export default function StatusBadge({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' };

  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}
