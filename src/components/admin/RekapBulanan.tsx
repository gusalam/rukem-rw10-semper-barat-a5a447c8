import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ExportButtons } from '@/components/ui/export-buttons';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Calendar, TrendingUp, TrendingDown, CheckCircle2, Clock, XCircle } from 'lucide-react';
import type { IuranTagihan, IuranPembayaran, Kas } from '@/types/database';
import { formatCurrency, formatPeriode } from '@/lib/format';
import { exportToPDF, exportToExcel } from '@/lib/export';

interface RekapBulananProps {
  tagihanList: IuranTagihan[];
  pembayaranList: IuranPembayaran[];
  kasList: Kas[];
}

interface MonthlyData {
  periode: string;
  periodeLabel: string;
  totalTagihan: number;
  tagihanCount: number;
  lunasCount: number;
  belumBayarCount: number;
  menungguCount: number;
  totalLunas: number;
  totalBelumBayar: number;
  totalMenunggu: number;
  pemasukan: number;
  pengeluaran: number;
  persentaseLunas: number;
}

const COLORS = {
  lunas: 'hsl(var(--success))',
  belumBayar: 'hsl(var(--destructive))',
  menunggu: 'hsl(var(--warning))',
};

export function RekapBulanan({ tagihanList, pembayaranList, kasList }: RekapBulananProps) {
  const [selectedYear, setSelectedYear] = useState<string>('all');

  // Get available years
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    tagihanList.forEach(t => {
      const year = t.periode.substring(0, 4);
      years.add(year);
    });
    return Array.from(years).sort().reverse();
  }, [tagihanList]);

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    const dataMap = new Map<string, MonthlyData>();

    // Process tagihan
    tagihanList.forEach(t => {
      if (selectedYear !== 'all' && !t.periode.startsWith(selectedYear)) return;

      if (!dataMap.has(t.periode)) {
        dataMap.set(t.periode, {
          periode: t.periode,
          periodeLabel: formatPeriode(t.periode),
          totalTagihan: 0,
          tagihanCount: 0,
          lunasCount: 0,
          belumBayarCount: 0,
          menungguCount: 0,
          totalLunas: 0,
          totalBelumBayar: 0,
          totalMenunggu: 0,
          pemasukan: 0,
          pengeluaran: 0,
          persentaseLunas: 0,
        });
      }

      const data = dataMap.get(t.periode)!;
      data.totalTagihan += t.nominal;
      data.tagihanCount += 1;

      if (t.status === 'lunas') {
        data.lunasCount += 1;
        data.totalLunas += t.nominal;
      } else if (t.status === 'menunggu_admin') {
        data.menungguCount += 1;
        data.totalMenunggu += t.nominal;
      } else {
        data.belumBayarCount += 1;
        data.totalBelumBayar += t.nominal;
      }
    });

    // Process kas
    kasList.forEach(k => {
      const periode = k.created_at.substring(0, 7);
      if (selectedYear !== 'all' && !periode.startsWith(selectedYear)) return;

      if (!dataMap.has(periode)) {
        dataMap.set(periode, {
          periode,
          periodeLabel: formatPeriode(periode),
          totalTagihan: 0,
          tagihanCount: 0,
          lunasCount: 0,
          belumBayarCount: 0,
          menungguCount: 0,
          totalLunas: 0,
          totalBelumBayar: 0,
          totalMenunggu: 0,
          pemasukan: 0,
          pengeluaran: 0,
          persentaseLunas: 0,
        });
      }

      const data = dataMap.get(periode)!;
      if (k.jenis === 'pemasukan') {
        data.pemasukan += k.nominal;
      } else {
        data.pengeluaran += k.nominal;
      }
    });

    // Calculate percentages
    dataMap.forEach(data => {
      if (data.tagihanCount > 0) {
        data.persentaseLunas = Math.round((data.lunasCount / data.tagihanCount) * 100);
      }
    });

    return Array.from(dataMap.values()).sort((a, b) => b.periode.localeCompare(a.periode));
  }, [tagihanList, kasList, selectedYear]);

  // Summary stats
  const summary = useMemo(() => {
    const total = monthlyData.reduce(
      (acc, d) => ({
        totalTagihan: acc.totalTagihan + d.totalTagihan,
        totalLunas: acc.totalLunas + d.totalLunas,
        totalBelumBayar: acc.totalBelumBayar + d.totalBelumBayar,
        totalMenunggu: acc.totalMenunggu + d.totalMenunggu,
        tagihanCount: acc.tagihanCount + d.tagihanCount,
        lunasCount: acc.lunasCount + d.lunasCount,
        belumBayarCount: acc.belumBayarCount + d.belumBayarCount,
        menungguCount: acc.menungguCount + d.menungguCount,
        pemasukan: acc.pemasukan + d.pemasukan,
        pengeluaran: acc.pengeluaran + d.pengeluaran,
      }),
      {
        totalTagihan: 0,
        totalLunas: 0,
        totalBelumBayar: 0,
        totalMenunggu: 0,
        tagihanCount: 0,
        lunasCount: 0,
        belumBayarCount: 0,
        menungguCount: 0,
        pemasukan: 0,
        pengeluaran: 0,
      }
    );

    return {
      ...total,
      persentaseLunas: total.tagihanCount > 0 ? Math.round((total.lunasCount / total.tagihanCount) * 100) : 0,
    };
  }, [monthlyData]);

  // Chart data for status distribution
  const statusChartData = [
    { name: 'Lunas', value: summary.lunasCount, color: COLORS.lunas },
    { name: 'Belum Bayar', value: summary.belumBayarCount, color: COLORS.belumBayar },
    { name: 'Menunggu Admin', value: summary.menungguCount, color: COLORS.menunggu },
  ].filter(d => d.value > 0);

  // Export columns
  const exportColumns = [
    { key: 'periodeLabel', header: 'Periode' },
    { key: 'tagihanCount', header: 'Jumlah Tagihan' },
    { key: 'lunasCount', header: 'Lunas' },
    { key: 'belumBayarCount', header: 'Belum Bayar' },
    { key: 'menungguCount', header: 'Menunggu Admin' },
    { key: 'totalTagihan', header: 'Total Tagihan', format: (v: number) => formatCurrency(v) },
    { key: 'totalLunas', header: 'Total Lunas', format: (v: number) => formatCurrency(v) },
    { key: 'totalBelumBayar', header: 'Total Belum Bayar', format: (v: number) => formatCurrency(v) },
    { key: 'pemasukan', header: 'Pemasukan Kas', format: (v: number) => formatCurrency(v) },
    { key: 'pengeluaran', header: 'Pengeluaran Kas', format: (v: number) => formatCurrency(v) },
    { key: 'persentaseLunas', header: '% Lunas', format: (v: number) => `${v}%` },
  ];

  const handleExportPDF = () => {
    const title = selectedYear !== 'all' 
      ? `Rekap Bulanan RUKEM - Tahun ${selectedYear}`
      : 'Rekap Bulanan RUKEM - Semua Tahun';
    exportToPDF(monthlyData, exportColumns, title, 'rekap-bulanan');
  };

  const handleExportExcel = () => {
    exportToExcel(monthlyData, exportColumns, 'Rekap Bulanan', 'rekap-bulanan');
  };

  if (monthlyData.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Belum ada data tagihan</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filter and export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Pilih tahun" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Tahun</SelectItem>
              {availableYears.map((year) => (
                <SelectItem key={year} value={year}>{year}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedYear !== 'all' && (
            <Badge variant="secondary">{monthlyData.length} bulan</Badge>
          )}
        </div>
        <ExportButtons
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          disabled={monthlyData.length === 0}
        />
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Tagihan Lunas</p>
                <p className="text-2xl font-bold">{summary.lunasCount}</p>
                <p className="text-sm text-success">{formatCurrency(summary.totalLunas)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <XCircle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Belum Bayar</p>
                <p className="text-2xl font-bold">{summary.belumBayarCount}</p>
                <p className="text-sm text-destructive">{formatCurrency(summary.totalBelumBayar)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-success/10">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pemasukan</p>
                <p className="text-2xl font-bold text-success">{formatCurrency(summary.pemasukan)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <TrendingDown className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pengeluaran</p>
                <p className="text-2xl font-bold text-destructive">{formatCurrency(summary.pengeluaran)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Bar Chart - Monthly Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Tren Tagihan per Bulan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[...monthlyData].reverse().slice(-12)}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="periodeLabel" 
                    tick={{ fontSize: 11 }}
                    tickFormatter={(value) => value.split(' ')[0]}
                  />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="totalLunas" name="Lunas" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="totalBelumBayar" name="Belum Bayar" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Pie Chart - Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribusi Status Tagihan</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={statusChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {statusChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="text-center mt-4">
              <p className="text-sm text-muted-foreground">Tingkat Keberhasilan</p>
              <p className="text-3xl font-bold text-primary">{summary.persentaseLunas}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Detail Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detail per Bulan</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {monthlyData.map((data) => (
              <div key={data.periode} className="border rounded-lg p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h4 className="font-semibold">{data.periodeLabel}</h4>
                    <p className="text-sm text-muted-foreground">
                      {data.tagihanCount} tagihan • {formatCurrency(data.totalTagihan)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="bg-success/10 text-success border-success/30">
                          {data.lunasCount} Lunas
                        </Badge>
                        <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30">
                          {data.belumBayarCount} Belum
                        </Badge>
                        {data.menungguCount > 0 && (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            {data.menungguCount} Menunggu
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Progress Pembayaran</span>
                    <span className="font-medium">{data.persentaseLunas}%</span>
                  </div>
                  <Progress value={data.persentaseLunas} className="h-2" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Pemasukan: </span>
                    <span className="font-medium text-success">{formatCurrency(data.pemasukan)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Pengeluaran: </span>
                    <span className="font-medium text-destructive">{formatCurrency(data.pengeluaran)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
