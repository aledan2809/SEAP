import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  Download,
  Eye,
  Upload,
  FolderOpen,
  File,
  FileSpreadsheet,
  FileArchive,
} from 'lucide-react';

const fileTypeIcons: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  doc: <FileText className="h-5 w-5 text-blue-500" />,
  docx: <FileText className="h-5 w-5 text-blue-500" />,
  xls: <FileSpreadsheet className="h-5 w-5 text-green-500" />,
  xlsx: <FileSpreadsheet className="h-5 w-5 text-green-500" />,
  zip: <FileArchive className="h-5 w-5 text-yellow-500" />,
  rar: <FileArchive className="h-5 w-5 text-yellow-500" />,
  default: <File className="h-5 w-5 text-gray-500" />,
};

function getFileIcon(filename: string) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return fileTypeIcons[ext] || fileTypeIcons.default;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function DocumentsPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Get all tender documents
  const tenderDocuments = await prisma.tenderDocument.findMany({
    where: {
      tender: {
        organization: {
          users: {
            some: { id: session.user.id },
          },
        },
      },
    },
    include: {
      tender: {
        select: {
          id: true,
          title: true,
          seapId: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  // Get company documents (templates, etc.)
  const companyDocuments = await prisma.companyDocument.findMany({
    where: {
      organization: {
        users: {
          some: { id: session.user.id },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Stats
  const totalDocs = tenderDocuments.length + companyDocuments.length;
  const totalSize = [...tenderDocuments, ...companyDocuments].reduce(
    (acc, doc) => acc + (doc.fileSize || 0),
    0
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Documente</h1>
          <p className="text-muted-foreground mt-1">
            {totalDocs} documente • {formatFileSize(totalSize)}
          </p>
        </div>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Încarcă Document
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documente Licitații
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tenderDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Documente Firmă
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{companyDocuments.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Spațiu Utilizat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatFileSize(totalSize)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Company Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            Documente Firmă
          </CardTitle>
          <CardDescription>
            Template-uri, certificate și alte documente standard ale firmei
          </CardDescription>
        </CardHeader>
        <CardContent>
          {companyDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FolderOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu ai încărcat documente ale firmei.</p>
              <p className="text-sm mt-2">
                Încarcă certificate, template-uri și alte documente standard.
              </p>
              <Button className="mt-4">
                <Upload className="mr-2 h-4 w-4" />
                Încarcă Document
              </Button>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {companyDocuments.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-accent"
                >
                  {getFileIcon(doc.name)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{doc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {doc.docType} • {formatFileSize(doc.fileSize || 0)}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon">
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tender Documents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Documente Licitații
          </CardTitle>
          <CardDescription>
            Documentele descărcate automat de pe SEAP pentru licitații
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tenderDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nu există documente descărcate.</p>
              <p className="text-sm mt-2">
                Documentele vor fi descărcate automat când n8n găsește licitații.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Licitație</TableHead>
                  <TableHead>Tip</TableHead>
                  <TableHead>Mărime</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenderDocuments.map((doc) => (
                  <TableRow key={doc.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getFileIcon(doc.filename)}
                        <span className="truncate max-w-[200px]">{doc.filename}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/tenders/${doc.tender.id}`}
                        className="hover:underline text-sm"
                      >
                        <div className="truncate max-w-[200px]" title={doc.tender.title}>
                          {doc.tender.title}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {doc.tender.seapId}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{doc.docType}</Badge>
                    </TableCell>
                    <TableCell>{formatFileSize(doc.fileSize)}</TableCell>
                    <TableCell>
                      {new Date(doc.createdAt).toLocaleDateString('ro-RO')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon">
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
