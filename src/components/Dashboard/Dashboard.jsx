import React, { useEffect, useState, useMemo, useCallback } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
    Cell, CartesianGrid, Legend, Sankey, Rectangle
} from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, Users, DollarSign, Sun, Moon, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

// ─── Formatters ──────────────────────────────────────────────────────────────

const formatCurrency = (value) => {
    if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
};

const formatNumber = (value) => {
    if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
    if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
    if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
    return `${Math.round(value)}`;
};

const formatFullCurrency = (value) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

// ─── Chain colours ────────────────────────────────────────────────────────────

const CHAIN_COLORS = {
    'Algorand': 'var(--accent-primary)',
    'Ethereum': '#627EEA',
    'BNB Chain': '#F3BA2F',
    'Tron': '#FF0013',
    'Solana': '#9945FF',
    'Polygon': '#8247E5',
    'Arbitrum': '#28A0F0',
    'Stellar': '#14B8F5',
    'Avalanche': '#E84142',
    'Base': '#0052FF',
    'OP Mainnet': '#FF0420',
    'Celo': '#35D07F',
    'Sonic': '#FF6B35',
    'Sui': '#4DA2FF',
    'Unichain': '#FF007A',
    'Linea': '#61DFFF',
};

const chainColor = (name) => CHAIN_COLORS[name] || '#8888aa';

// ─── CSV parsers ──────────────────────────────────────────────────────────────

const parseMainCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    return lines.slice(1).map(line => {
        const v = line.split(',');
        return {
            date: v[0].replace(/"/g, ''),
            transactions: +v[1] || 0,
            users: +v[2] || 0,
            src_volume: +v[3] || 0,
            dst_volume: +v[4] || 0,
            volume: +v[5] || 0,
            transactions_mtd: +v[6] || 0,
            users_mtd: +v[7] || 0,
            volume_mtd: +v[8] || 0,
        };
    });
};

// source.csv  → col0: destination_chain, col1: transfer_count, col2: total_usdc_sent
const parseSourceCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    return lines.slice(1)
        .map(line => {
            const v = line.split(',');
            return {
                chain: v[0].replace(/"/g, '').trim(),
                count: +v[1] || 0,
                value: +v[2] || 0,
            };
        })
        .filter(r => r.chain && r.value > 0);
};

// destination.csv → col0: source_chain, col1: transfer_count, col2: total_usdc_received
const parseDestinationCSV = (csvText) => {
    const lines = csvText.trim().split('\n');
    return lines.slice(1)
        .map(line => {
            const v = line.split(',');
            return {
                chain: v[0].replace(/"/g, '').trim(),
                count: +v[1] || 0,
                value: +v[2] || 0,
            };
        })
        .filter(r => r.chain && r.value > 0);
};

// ─── Build recharts Sankey data ───────────────────────────────────────────────

// Outflow: Algorand → each destination chain
const buildOutflowSankey = (rows) => {
    const nodes = [{ name: 'Algorand' }, ...rows.map(r => ({ name: r.chain }))];
    const links = rows.map((r, i) => ({ source: 0, target: i + 1, value: r.value }));
    return { nodes, links };
};

// Inflow: each source chain → Algorand
const buildInflowSankey = (rows) => {
    const algoIndex = rows.length;
    const nodes = [...rows.map(r => ({ name: r.chain })), { name: 'Algorand' }];
    const links = rows.map((r, i) => ({ source: i, target: algoIndex, value: r.value }));
    return { nodes, links };
};

// ─── Custom Sankey node ───────────────────────────────────────────────────────

const SankeyNode = ({ x, y, width, height, index, payload }) => {
    const name = payload?.name || '';
    const color = chainColor(name);
    const isRight = x > 300;

    return (
        <g>
            <Rectangle
                x={x} y={y} width={width} height={height}
                fill={color} fillOpacity={0.95} radius={3}
            />
            <text
                x={isRight ? x + width + 8 : x - 8}
                y={y + height / 2}
                textAnchor={isRight ? 'start' : 'end'}
                dominantBaseline="middle"
                style={{ fontSize: 12, fontWeight: 600, fill: 'var(--text-primary)' }}
            >
                {name}
            </text>
        </g>
    );
};

// ─── Custom Sankey link ───────────────────────────────────────────────────────

const SankeyLink = ({ sourceX, sourceY, sourceControlX, targetX, targetY, targetControlX, linkWidth, payload, index }) => {
    const sourceNode = payload?.source?.name || '';
    const targetNode = payload?.target?.name || '';
    const isAlgoSource = sourceNode === 'Algorand';
    const colorName = isAlgoSource ? targetNode : sourceNode;
    const color = chainColor(colorName);

    return (
        <path
            d={`
                M${sourceX},${sourceY}
                C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}
            `}
            fill="none"
            stroke={color}
            strokeWidth={linkWidth}
            strokeOpacity={0.3}
        />
    );
};

// ─── Sankey tooltip ───────────────────────────────────────────────────────────

const SankeyTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    if (!d) return null;

    const isNode = d.value !== undefined && d.name;
    const label = isNode
        ? `${d.name}: ${formatFullCurrency(d.value)}`
        : `${d.source?.name} → ${d.target?.name}: ${formatFullCurrency(d.value)}`;

    return (
        <div style={{
            backgroundColor: 'var(--card-bg)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: 'var(--text-primary)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        }}>
            {label}
        </div>
    );
};

// ─── Volume Tooltip / Legend (unchanged) ─────────────────────────────────────

const VolumeTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const src = payload.find(p => p.dataKey === 'src_volume')?.value || 0;
    const dst = payload.find(p => p.dataKey === 'dst_volume')?.value || 0;
    const total = src + dst;
    return (
        <div style={{
            backgroundColor: '#161821', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#fff'
        }}>
            <p style={{ marginBottom: 6, fontWeight: 600 }}>{label}</p>
            <p style={{ color: 'var(--accent-primary)', margin: '2px 0' }}>Source: {formatFullCurrency(src)}</p>
            <p style={{ color: 'var(--accent-secondary)', margin: '2px 0' }}>Destination: {formatFullCurrency(dst)}</p>
            <p style={{ color: '#fff', marginTop: 6, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: 6, fontWeight: 700 }}>
                Total: {formatFullCurrency(total)}
            </p>
        </div>
    );
};

const VolumeLegend = ({ chartData }) => {
    const totalSrc = chartData.reduce((acc, d) => acc + (d.src_volume || 0), 0);
    const totalDst = chartData.reduce((acc, d) => acc + (d.dst_volume || 0), 0);
    const grandTotal = totalSrc + totalDst;
    return (
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingTop: '14px' }}>
            {[{ label: 'Source Volume', color: 'var(--accent-primary)' }, { label: 'Destination Volume', color: 'var(--accent-secondary)' }].map(({ label, color }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 2, backgroundColor: color, flexShrink: 0 }} />
                    {label}
                </span>
            ))}
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', borderLeft: '1px solid rgba(128,128,128,0.3)', paddingLeft: 16 }}>
                Total: {formatFullCurrency(grandTotal)}
            </span>
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const TABS = ['Transactions', 'Users', 'Volume', 'Outflow', 'Inflow'];

const Dashboard = () => {
    const [rawData, setRawData] = useState(null);
    const [sourceData, setSourceData] = useState(null);   // source.csv rows
    const [destData, setDestData] = useState(null);   // destination.csv rows
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Transactions');
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (isDarkMode) document.documentElement.classList.remove('light-mode');
        else document.documentElement.classList.add('light-mode');
    }, [isDarkMode]);

    // Fetch all three CSVs in parallel
    useEffect(() => {
        Promise.all([
            fetch('/allbridge.csv').then(r => r.text()),
            fetch('/source.csv').then(r => r.text()),
            fetch('/destination.csv').then(r => r.text()),
        ])
            .then(([mainCsv, srcCsv, dstCsv]) => {
                setRawData(parseMainCSV(mainCsv));
                setSourceData(parseSourceCSV(srcCsv));
                setDestData(parseDestinationCSV(dstCsv));
                setLoading(false);
            })
            .catch(err => {
                console.error('Failed to load data', err);
                setLoading(false);
            });
    }, []);

    const processedData = useMemo(() => {
        if (!rawData || rawData.length < 2) return null;
        const history = [...rawData].sort((a, b) => a.date.localeCompare(b.date));
        const cur = history[history.length - 1];
        const prev = history[history.length - 2];
        const pct = (c, p) => p > 0 ? ((c - p) / p) * 100 : 0;
        return {
            currentTransactions: cur.transactions_mtd,
            currentUsers: cur.users_mtd,
            currentVolume: cur.volume_mtd,
            transactionsDelta: pct(cur.transactions_mtd, prev.transactions_mtd),
            usersDelta: pct(cur.users_mtd, prev.users_mtd),
            volumeDelta: pct(cur.volume_mtd, prev.volume_mtd),
            history,
        };
    }, [rawData]);

    // Sankey datasets
    const outflowSankey = useMemo(() => sourceData ? buildOutflowSankey(sourceData) : null, [sourceData]);
    const inflowSankey = useMemo(() => destData ? buildInflowSankey(destData) : null, [destData]);

    if (loading) return <div className="loading">Loading data...</div>;
    if (!rawData) return <div className="error">Failed to load data. Please run the fetcher script.</div>;

    const { currentTransactions, currentUsers, currentVolume,
        transactionsDelta, usersDelta, volumeDelta, history } = processedData || {};

    const chartData = history ? history.slice(-12).map(item => {
        const [year, month] = item.date.split('-');
        const date = new Date(parseInt(year), parseInt(month) - 1, 15);
        return {
            name: date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
            transactions: item.transactions,
            users: item.users,
            volume: item.volume,
            src_volume: item.src_volume,
            dst_volume: item.dst_volume,
        };
    }) : [];

    const accentColor = 'var(--accent-primary)';

    // ── Chart renderer ────────────────────────────────────────────────────────

    const renderChart = () => {
        switch (activeTab) {

            case 'Transactions':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatNumber} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Number of Transactions', position: 'insideLeft', angle: -90, offset: 0, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#161821', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }} formatter={(v) => [formatNumber(v), 'Transactions']} />
                            <Bar dataKey="transactions" radius={[4, 4, 0, 0]} name="Monthly Transactions" barSize={30} animationDuration={1000}>
                                {chartData.map((_, i) => <Cell key={i} fill={accentColor} />)}
                            </Bar>
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line"
                                formatter={(v) => <span style={{ color: 'var(--text-primary)' }}>{v}</span>} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'Users':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatNumber} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Number of Users', position: 'insideLeft', angle: -90, offset: 0, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#161821', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }} formatter={(v) => [formatNumber(v), 'Users']} />
                            <Bar dataKey="users" radius={[4, 4, 0, 0]} barSize={30} animationDuration={1000} name="Monthly Users">
                                {chartData.map((_, i) => <Cell key={i} fill={accentColor} />)}
                            </Bar>
                            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line"
                                formatter={(v) => <span style={{ color: 'var(--text-primary)' }}>{v}</span>} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'Volume':
                return (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <YAxis axisLine={false} tickLine={false} tickFormatter={formatCurrency} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Volume ($)', position: 'insideLeft', angle: -90, offset: -5, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }} />
                            <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="src_volume" name="Source Volume" stackId="vol" fill="var(--accent-primary)" radius={[0, 0, 0, 0]} barSize={30} animationDuration={1000} />
                            <Bar dataKey="dst_volume" name="Destination Volume" stackId="vol" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} barSize={30} animationDuration={1000} />
                            <Legend content={<VolumeLegend chartData={chartData} />} />
                        </BarChart>
                    </ResponsiveContainer>
                );

            // ── Outflow: Algorand → destination chains ────────────────────────
            case 'Outflow':
                if (!outflowSankey) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading outflow data…</div>;
                return (
                    <div>
                        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Total USDC bridged <strong style={{ color: 'var(--accent-primary)' }}>out of Algorand</strong> by destination chain (all-time)
                        </p>
                        <ResponsiveContainer width="100%" height={420}>
                            <Sankey
                                data={outflowSankey}
                                nodePadding={18}
                                nodeWidth={14}
                                margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
                                node={<SankeyNode />}
                                link={<SankeyLink />}
                            >
                                <Tooltip content={<SankeyTooltip />} />
                            </Sankey>
                        </ResponsiveContainer>
                        <SankeyLegend rows={sourceData} label="Outflow to" />
                    </div>
                );

            // ── Inflow: source chains → Algorand ─────────────────────────────
            case 'Inflow':
                if (!inflowSankey) return <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-secondary)' }}>Loading inflow data…</div>;
                return (
                    <div>
                        <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
                            Total USDC bridged <strong style={{ color: 'var(--accent-primary)' }}>into Algorand</strong> by source chain (all-time)
                        </p>
                        <ResponsiveContainer width="100%" height={420}>
                            <Sankey
                                data={inflowSankey}
                                nodePadding={18}
                                nodeWidth={14}
                                margin={{ top: 10, right: 160, bottom: 10, left: 160 }}
                                node={<SankeyNode />}
                                link={<SankeyLink />}
                            >
                                <Tooltip content={<SankeyTooltip />} />
                            </Sankey>
                        </ResponsiveContainer>
                        <SankeyLegend rows={destData} label="Inflow from" />
                    </div>
                );

            default:
                return null;
        }
    };

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <div className="header-top">
                    <div className="logo-area">
                        <div className="badge">
                            <img style={{ width: '32px', height: '32px' }} src="/logo.webp" alt="Allbridge" />
                        </div>
                        <h1 className="h1-gradient">Allbridge Analytics</h1>
                    </div>
                    <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            <div className="kpi-grid-3">
                <Card title="Transactions"
                    value={currentTransactions}
                    delta={transactionsDelta}
                    icon={<Activity size={24} />}
                    isActive={activeTab === 'Transactions'}
                    onClick={() => setActiveTab('Transactions')}
                    formatValue={formatNumber} />
                <Card title="Users"
                    value={currentUsers}
                    delta={usersDelta}
                    icon={<Users size={24} />}
                    isActive={activeTab === 'Users'}
                    onClick={() => setActiveTab('Users')}
                    formatValue={formatNumber} />
                <Card title="Volume"
                    value={currentVolume}
                    delta={volumeDelta}
                    icon={<DollarSign size={24} />}
                    isActive={activeTab === 'Volume'}
                    onClick={() => setActiveTab('Volume')} formatValue={formatCurrency} />
            </div>

            <div className="chart-section glass-card">
                <div className="chart-header">
                    <div className="chart-tabs">
                        {TABS.map(tab => (
                            <button
                                key={tab}
                                className={`chart-tab ${activeTab === tab ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab)}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    <div className="chart-legend">
                        <span className={`dot ${activeTab.toLowerCase()}-dot`}></span>
                        {activeTab}
                    </div>
                </div>
                <div className="chart-wrapper">
                    {renderChart()}
                </div>
            </div>

            <p className="disclaimer">
                <AlertTriangle size={14} style={{ marginRight: '6px', verticalAlign: 'middle', display: 'inline-block' }} />
                Data provided Nodely, queried by Algorand Foundation.
            </p>
        </div>
    );
};

// ─── Sankey chain legend ──────────────────────────────────────────────────────

const SankeyLegend = ({ rows, label }) => {
    if (!rows) return null;
    const total = rows.reduce((acc, r) => acc + r.value, 0);
    return (
        <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '10px 20px',
            justifyContent: 'center', padding: '16px 8px 4px',
            borderTop: '1px solid rgba(128,128,128,0.15)', marginTop: 8,
        }}>
            {rows.map(r => (
                <span key={r.chain} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-primary)' }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, flexShrink: 0, backgroundColor: chainColor(r.chain), display: 'inline-block' }} />
                    <span style={{ fontWeight: 600 }}>{r.chain}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(r.value)}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: 11 }}>({((r.value / total) * 100).toFixed(1)}%)</span>
                </span>
            ))}
        </div>
    );
};

// ─── KPI Card (unchanged) ─────────────────────────────────────────────────────

const Card = ({ title, value, delta, icon, isActive, onClick, formatValue = formatCurrency }) => {
    const isPositive = delta >= 0;
    return (
        <div className={`kpi-card glass-card ${isActive ? 'active-card' : ''}`} onClick={onClick} style={{ cursor: 'pointer' }}>
            <div className="card-icon-wrapper">{icon}</div>
            <div className="card-content">
                <h3>{title}</h3>
                <div className="card-value">{formatValue(value)}</div>
                <div className={`card-delta ${isPositive ? 'positive' : 'negative'}`}>
                    {isPositive ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                    <span>{Math.abs(delta).toFixed(2)}%</span>
                    <span className="delta-label">vs last month (MTD)</span>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;