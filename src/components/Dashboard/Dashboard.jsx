import React, { useEffect, useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, Users, TrendingUp, Sun, Moon, AlertTriangle } from 'lucide-react';
import './Dashboard.css';

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

const formatFullCurrency = (value) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
};

const VolumeTooltip = ({ active, payload, label }) => {
    if (!active || !payload || !payload.length) return null;
    const src = payload.find(p => p.dataKey === 'src_volume')?.value || 0;
    const dst = payload.find(p => p.dataKey === 'dst_volume')?.value || 0;
    const total = src + dst;
    return (
        <div style={{
            backgroundColor: '#161821',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            color: '#fff'
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

    const swatches = [
        { label: 'Source Volume', color: 'var(--accent-primary)' },
        { label: 'Destination Volume', color: 'var(--accent-secondary)' },
    ];

    return (
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', alignItems: 'center', flexWrap: 'wrap', paddingTop: '14px' }}>
            {swatches.map(({ label, color }) => (
                <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-primary)' }}>
                    <span style={{
                        display: 'inline-block', width: 12, height: 12,
                        borderRadius: 2, backgroundColor: color, flexShrink: 0
                    }} />
                    {label}
                </span>
            ))}
            <span style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 700, color: 'var(--text-primary)',
                borderLeft: '1px solid rgba(128,128,128,0.3)', paddingLeft: 16
            }}>
                Total: {formatFullCurrency(grandTotal)}
            </span>
        </div>
    );
};

const Dashboard = () => {
    const [rawData, setRawData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('Transactions');
    // Default theme is now LIGHT
    const [isDarkMode, setIsDarkMode] = useState(false);

    useEffect(() => {
        if (isDarkMode) {
            document.documentElement.classList.remove('light-mode');
        } else {
            document.documentElement.classList.add('light-mode');
        }
    }, [isDarkMode]);

    useEffect(() => {
        fetch('/allbridge.csv')
            .then(res => res.text())
            .then(csvText => {
                const data = parseCSV(csvText);
                setRawData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load data", err);
                setLoading(false);
            });
    }, []);

    /*
       Columns:
       0 date
       1 monthly_transactions
       2 monthly_active_users
       3 monthly_src_usdc   ← parsed for stacked chart
       4 monthly_dst_usdc   ← parsed for stacked chart
       5 monthly_usdc (total)
       6 transactions_mtd
       7 active_users_mtd
       8 volume_mtd
    */
    const parseCSV = (csvText) => {
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
                volume_mtd: +v[8] || 0
            };
        });
    };

    const processedData = useMemo(() => {
        if (!rawData || rawData.length < 2) return null;

        const history = [...rawData].sort((a, b) => a.date.localeCompare(b.date));
        const currentMonth = history[history.length - 1];
        const previousMonth = history[history.length - 2];

        const pct = (curr, prev) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;

        return {
            currentTransactions: currentMonth.transactions_mtd,
            currentUsers: currentMonth.users_mtd,
            currentVolume: currentMonth.volume_mtd,

            transactionsDelta: pct(currentMonth.transactions_mtd, previousMonth.transactions_mtd),
            usersDelta: pct(currentMonth.users_mtd, previousMonth.users_mtd),
            volumeDelta: pct(currentMonth.volume_mtd, previousMonth.volume_mtd),

            history
        };
    }, [rawData]);

    if (loading) return <div className="loading">Loading data...</div>;
    if (!rawData) return <div className="error">Failed to load data. Please run the fetcher script.</div>;

    const {
        currentTransactions, currentUsers, currentVolume,
        transactionsDelta, usersDelta, volumeDelta,
        history
    } = processedData || {};

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

    const renderChart = () => {
        switch (activeTab) {
            case 'Transactions':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis
                                dataKey="name" axisLine={false} tickLine={false}
                                tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <YAxis
                                axisLine={false} tickLine={false}
                                tickFormatter={formatNumber} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Number of Transactions', position: 'insideLeft', angle: -90, offset: 0, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#161821', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value) => [formatNumber(value), 'Transactions']}
                            />
                            <Bar dataKey="transactions" radius={[4, 4, 0, 0]} name="Monthly Transactions" barSize={30} animationDuration={1000}>
                                {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={accentColor} />)}
                            </Bar>
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }} iconType="line"
                                formatter={(value) => <span style={{ color: 'var(--text-primary)' }}>{value}</span>}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'Users':
                return (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <XAxis
                                dataKey="name" axisLine={false} tickLine={false}
                                tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <YAxis
                                axisLine={false} tickLine={false}
                                tickFormatter={formatNumber} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Number of Users', position: 'insideLeft', angle: -90, offset: 0, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <Tooltip
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                contentStyle={{ backgroundColor: '#161821', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '8px' }}
                                itemStyle={{ color: '#fff' }}
                                formatter={(value) => [formatNumber(value), 'Users']}
                            />
                            <Bar dataKey="users" radius={[4, 4, 0, 0]} barSize={30} animationDuration={1000} name="Monthly Users">
                                {chartData.map((_, index) => <Cell key={`cell-${index}`} fill={accentColor} />)}
                            </Bar>
                            <Legend
                                wrapperStyle={{ paddingTop: '20px' }} iconType="line"
                                formatter={(value) => <span style={{ color: 'var(--text-primary)' }}>{value}</span>}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                );

            case 'Volume':
                return (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.15)" />
                            <XAxis
                                dataKey="name" axisLine={false} tickLine={false}
                                tick={{ fill: accentColor, fontSize: 12 }} dy={10}
                                label={{ value: 'Date', position: 'insideBottom', offset: -15, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <YAxis
                                axisLine={false} tickLine={false}
                                tickFormatter={formatCurrency} tick={{ fill: accentColor, fontSize: 12 }}
                                label={{ value: 'Volume ($)', position: 'insideLeft', angle: -90, offset: -5, style: { fill: 'var(--text-primary)', textAnchor: 'middle' } }}
                            />
                            <Tooltip content={<VolumeTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                            <Bar dataKey="src_volume" name="Source Volume" stackId="vol" fill="var(--accent-primary)" radius={[0, 0, 0, 0]} barSize={30} animationDuration={1000} />
                            <Bar dataKey="dst_volume" name="Destination Volume" stackId="vol" fill="var(--accent-secondary)" radius={[4, 4, 0, 0]} barSize={30} animationDuration={1000} />
                            <Legend content={<VolumeLegend chartData={chartData} />} />
                        </BarChart>
                    </ResponsiveContainer>
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
                        <h1 className="h1-gradient">Interoperability on Algorand</h1>
                    </div>
                    <button className="theme-toggle" onClick={() => setIsDarkMode(!isDarkMode)}>
                        {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
            </header>

            <div className="kpi-grid-3">
                <Card
                    title="Transactions" value={currentTransactions} delta={transactionsDelta}
                    icon={<Activity size={24} />} isActive={activeTab === 'Transactions'}
                    onClick={() => setActiveTab('Transactions')} formatValue={formatNumber}
                />
                <Card
                    title="Users" value={currentUsers} delta={usersDelta}
                    icon={<Users size={24} />} isActive={activeTab === 'Users'}
                    onClick={() => setActiveTab('Users')} formatValue={formatNumber}
                />
                <Card
                    title="Volume" value={currentVolume} delta={volumeDelta}
                    icon={<TrendingUp size={24} />} isActive={activeTab === 'Volume'}
                    onClick={() => setActiveTab('Volume')} formatValue={formatCurrency}
                />
            </div>

            <div className="chart-section glass-card">
                <div className="chart-header">
                    <div className="chart-tabs">
                        {['Transactions', 'Users', 'Volume'].map(tab => (
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

const Card = ({ title, value, delta, icon, isActive, onClick, formatValue = formatCurrency }) => {
    const isPositive = delta >= 0;
    return (
        <div
            className={`kpi-card glass-card ${isActive ? 'active-card' : ''}`}
            onClick={onClick}
            style={{ cursor: 'pointer' }}
        >
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