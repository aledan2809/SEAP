'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Brain,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Target,
  Shield,
} from 'lucide-react';
import { toast } from 'sonner';

interface Analysis {
  id: string;
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  threats: string[];
  recommendation: string;
  aiSummary: string | null;
  confidence: number | null;
  analyzedAt: Date;
}

interface TenderAnalysisProps {
  analysis: Analysis | null;
  tenderId: string;
}

const recommendationConfig: Record<
  string,
  { label: string; color: string; icon: React.ReactNode }
> = {
  GO: {
    label: 'Recomandat',
    color: 'bg-green-100 text-green-800 border-green-300',
    icon: <ThumbsUp className="h-4 w-4" />,
  },
  CAUTION: {
    label: 'Cu rezerve',
    color: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    icon: <AlertTriangle className="h-4 w-4" />,
  },
  NO_GO: {
    label: 'Nu recomandat',
    color: 'bg-red-100 text-red-800 border-red-300',
    icon: <ThumbsDown className="h-4 w-4" />,
  },
  PENDING: {
    label: 'În așteptare',
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    icon: <Brain className="h-4 w-4" />,
  },
};

export function TenderAnalysis({ analysis, tenderId }: TenderAnalysisProps) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/tenders/${tenderId}/analyze`, {
        method: 'POST',
      });

      if (!res.ok) throw new Error('Failed to analyze');

      toast.success('Analiza a fost pornită. Rezultatele vor apărea în curând.');
    } catch {
      toast.error('Eroare la pornirea analizei');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analiză AI
          </CardTitle>
          <CardDescription>
            Lasă AI-ul să analizeze documentele și să identifice punctele forte și slabe
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground mb-4">
              Nu există încă o analiză pentru această licitație.
            </p>
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Brain className="mr-2 h-4 w-4" />
              )}
              Analizează cu AI
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  const recConfig = recommendationConfig[analysis.recommendation] || recommendationConfig.PENDING;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Analiză AI
          </CardTitle>
          <Badge className={`${recConfig.color} flex items-center gap-1`}>
            {recConfig.icon}
            {recConfig.label}
          </Badge>
        </div>
        <CardDescription>
          Analizat la{' '}
          {new Date(analysis.analyzedAt).toLocaleDateString('ro-RO', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
          {analysis.confidence && ` • Încredere: ${Math.round(analysis.confidence * 100)}%`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary */}
        {analysis.aiSummary && (
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm">{analysis.aiSummary}</p>
          </div>
        )}

        {/* SWOT Grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Strengths */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-green-700">
              <TrendingUp className="h-4 w-4" />
              Puncte Forte ({analysis.strengths.length})
            </h4>
            {analysis.strengths.length > 0 ? (
              <ul className="text-sm space-y-1">
                {analysis.strengths.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-green-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Niciun punct identificat</p>
            )}
          </div>

          {/* Weaknesses */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-red-700">
              <TrendingDown className="h-4 w-4" />
              Puncte Slabe ({analysis.weaknesses.length})
            </h4>
            {analysis.weaknesses.length > 0 ? (
              <ul className="text-sm space-y-1">
                {analysis.weaknesses.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-red-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Niciun punct identificat</p>
            )}
          </div>

          {/* Opportunities */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-blue-700">
              <Target className="h-4 w-4" />
              Oportunități ({analysis.opportunities.length})
            </h4>
            {analysis.opportunities.length > 0 ? (
              <ul className="text-sm space-y-1">
                {analysis.opportunities.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Niciuna identificată</p>
            )}
          </div>

          {/* Threats */}
          <div className="space-y-2">
            <h4 className="text-sm font-medium flex items-center gap-2 text-orange-700">
              <Shield className="h-4 w-4" />
              Amenințări ({analysis.threats.length})
            </h4>
            {analysis.threats.length > 0 ? (
              <ul className="text-sm space-y-1">
                {analysis.threats.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-orange-500 mt-1">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">Niciuna identificată</p>
            )}
          </div>
        </div>

        {/* Re-analyze button */}
        <div className="pt-4 border-t">
          <Button variant="outline" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
            {isAnalyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Brain className="mr-2 h-4 w-4" />
            )}
            Re-analizează
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
