import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Clock,
  FileText,
  AlertCircle,
  CheckCircle,
  XCircle,
  Bell,
  Calendar,
} from 'lucide-react';

interface TenderEvent {
  id: string;
  eventType: string;
  title: string;
  details: string | null;
  seapDate: Date;
  createdAt: Date;
}

interface TenderTimelineProps {
  events: TenderEvent[];
}

const eventIcons: Record<string, React.ReactNode> = {
  PUBLISHED: <Calendar className="h-4 w-4" />,
  CLARIFICATION: <FileText className="h-4 w-4" />,
  MODIFICATION: <AlertCircle className="h-4 w-4" />,
  DEADLINE_CHANGE: <Clock className="h-4 w-4" />,
  RESULT: <CheckCircle className="h-4 w-4" />,
  CANCELLED: <XCircle className="h-4 w-4" />,
  OTHER: <Bell className="h-4 w-4" />,
};

const eventColors: Record<string, string> = {
  PUBLISHED: 'bg-blue-100 text-blue-600',
  CLARIFICATION: 'bg-yellow-100 text-yellow-600',
  MODIFICATION: 'bg-orange-100 text-orange-600',
  DEADLINE_CHANGE: 'bg-purple-100 text-purple-600',
  RESULT: 'bg-green-100 text-green-600',
  CANCELLED: 'bg-red-100 text-red-600',
  OTHER: 'bg-gray-100 text-gray-600',
};

export function TenderTimeline({ events }: TenderTimelineProps) {
  if (events.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4 text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Nu există evenimente.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="flex gap-3">
              {/* Icon */}
              <div
                className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  eventColors[event.eventType] || eventColors.OTHER
                }`}
              >
                {eventIcons[event.eventType] || eventIcons.OTHER}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{event.title}</p>
                {event.details && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {event.details}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {new Date(event.seapDate).toLocaleDateString('ro-RO', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {/* Line connector */}
              {index < events.length - 1 && (
                <div className="absolute left-4 mt-8 w-0.5 h-full bg-border" />
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
