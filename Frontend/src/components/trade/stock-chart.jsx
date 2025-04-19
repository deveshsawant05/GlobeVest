import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { convertUTCToLocal } from "@/lib/utils";

export default function StockChart({
  stock,
  priceHistory,
  timeRange,
  timeRangeOptions,
  handleTimeRangeChange,
  isLoading,
  chartUpdateTrigger
}) {
  // Format currency
  const formatCurrency = (amount, currency) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency || "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  // Get market trend for display
  const getMarketTrend = () => {
    if (!stock) {
      return { positive: true, percent: "0.00" };
    }
    
    const changePercent = stock.change_percentage;
    return {
      positive: changePercent >= 0,
      percent: Math.abs(changePercent).toFixed(2)
    };
  };
  
  // Market trend calculation
  const marketTrend = getMarketTrend();

  // Helper function to get appropriate axis ticks
  const getAxisTicks = (dataLength) => {
    if (dataLength <= 5) return undefined; // Let Recharts decide for small datasets
    
    // Generate 5 evenly spaced ticks
    const result = [];
    const tickCount = Math.min(5, dataLength);
    const step = Math.floor(dataLength / (tickCount - 1));
    
    for (let i = 0; i < dataLength; i += step) {
      result.push(i);
      if (result.length >= tickCount - 1) break;
    }
    
    // Always include the last point
    if (dataLength > 1 && result[result.length - 1] !== dataLength - 1) {
      result.push(dataLength - 1);
    }
    
    return result;
  };

  // Format time for chart tooltip based on selected time range
  const formatChartTime = (timestamp) => {
    const localDate = new Date(timestamp);
    
    // Use appropriate format based on time range
    const config = timeRangeOptions[timeRange];
    const options = {
      hour: "numeric",
      minute: "numeric"
    };
    
    if (timeRange === "5m" || timeRange === "1h") {
      // For small time ranges, show seconds
      options.second = "numeric";
    }
    
    if (timeRange === "1M") {
      // For monthly view, show date
      options.month = "short";
      options.day = "numeric";
      delete options.hour;
      delete options.minute;
    }
    
    if (timeRange === "1d") {
      // For daily view, keep hours and minutes
      options.hour = "numeric";
      options.minute = "numeric";
    }
    
    return localDate.toLocaleTimeString(undefined, options);
  };

  // Format date for display - using the local timezone
  const formatDate = (date) => {
    if (!date) return "";
    
    // Convert UTC to local time
    const localDate = convertUTCToLocal(date);
    
    const options = { 
      month: 'short', 
      day: 'numeric',
      year: localDate.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
    };
    
    return localDate.toLocaleDateString(undefined, options);
  };

  // Custom tooltip for the chart
  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-background rounded-lg border border-border p-3 shadow-md">
          <p className="text-sm font-medium">{formatDate(data.fullDate)}</p>
          <p className="text-sm text-muted-foreground">{formatChartTime(data.fullDate)}</p>
          <p className="text-sm font-bold mt-1">
            {formatCurrency(data.price, stock?.currency_code)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Volume: {data.volume?.toLocaleString() || '0'}
          </p>
        </div>
      );
    }
    return null;
  };

  // Get chart color based on price trend
  const getChartColor = () => {
    if (!priceHistory || priceHistory.length < 2) {
      return { stroke: "hsl(var(--primary))", fill: "hsl(var(--primary))", fillOpacity: 0.1 };
    }
    
    const firstPrice = priceHistory[0].price;
    const lastPrice = priceHistory[priceHistory.length - 1].price;
    const isPositive = lastPrice >= firstPrice;
    
    return {
      stroke: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fill: isPositive ? "hsl(142, 76%, 36%)" : "hsl(0, 84%, 60%)",
      fillOpacity: 0.1
    };
  };
  
  // Memoize the chart color calculation to prevent unnecessary re-renders
  const chartColor = useMemo(() => getChartColor(), [priceHistory]);
  
  // Create a stable identifier for the chart
  const chartKey = useMemo(() => `chart-${timeRange}-${chartUpdateTrigger}`, [timeRange, chartUpdateTrigger]);

  // Render the price chart with memoization
  const renderPriceChart = useMemo(() => {
    // Skip rendering if no data or loading
    if (!priceHistory.length) return null;
    
    // Calculate Y axis domain once
    const prices = priceHistory.map(p => p?.price).filter(Boolean);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const padding = (max - min) * 0.1;
    const domain = [min - padding, max + padding];
    
    // Get appropriate X-axis ticks based on time range
    let ticks;
    if (timeRange === "1d") {
      // For 1-day view, show more tick marks (every 4 hours)
      const result = [];
      // Assuming 96 points for 1 day (1 per 15 minutes)
      const totalPoints = priceHistory.length;
      // Every 16 points = 4 hours (16 * 15 = 240 minutes = 4 hours)
      const step = Math.floor(totalPoints / 6);
      
      for (let i = 0; i < totalPoints; i += step) {
        result.push(i);
      }
      // Always include the last point
      if (totalPoints > 1 && result[result.length - 1] !== totalPoints - 1) {
        result.push(totalPoints - 1);
      }
      ticks = result;
    } else if (timeRange === "1M") {
      // For 1-month view, show specific days (e.g., every 5 days)
      const result = [];
      const totalPoints = priceHistory.length;
      // Show approximately 6 points across the month
      const step = Math.floor(totalPoints / 6);
      
      for (let i = 0; i < totalPoints; i += step) {
        result.push(i);
      }
      // Always include the last point
      if (totalPoints > 1 && result[result.length - 1] !== totalPoints - 1) {
        result.push(totalPoints - 1);
      }
      ticks = result;
    } else {
      // For other views, use the general function
      ticks = getAxisTicks(priceHistory.length);
    }
    
    return (
      <LineChart
        key={chartKey}
        data={priceHistory}
        margin={{
          top: 10,
          right: 30,
          left: 10,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis 
          dataKey="id" 
          type="number"
          tickFormatter={(id) => {
            const item = priceHistory.find(p => p?.id === id);
            return item?.fullDate ? formatChartTime(item.fullDate) : '';
          }}
          domain={[0, priceHistory.length - 1]}
          ticks={ticks}
        />
        <YAxis 
          orientation="right"
          domain={domain}
          tickFormatter={(value) => formatCurrency(value, stock?.currency_code).replace(/[^\d.]/g, '')}
        />
        <Tooltip content={<CustomTooltip />} />
        <Line
          type="monotoneX"
          dataKey="price"
          stroke={chartColor.stroke}
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 6, strokeWidth: 1, stroke: "#fff" }}
          isAnimationActive={false}
          connectNulls={true}
        />
      </LineChart>
    );
  }, [priceHistory, chartKey, stock, chartColor, timeRange]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Price Chart</CardTitle>
        <div className="flex items-center gap-4">
          <div className={`flex items-center text-sm ${marketTrend.positive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {marketTrend.positive ? (
              <TrendingUp className="mr-1 h-4 w-4" />
            ) : (
              <TrendingDown className="mr-1 h-4 w-4" />
            )}
            {marketTrend.positive ? '+' : '-'}{marketTrend.percent}%
          </div>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="flex space-x-2">
              {Object.entries(timeRangeOptions).map(([key, value]) => (
                <button
                  key={key}
                  onClick={() => handleTimeRangeChange(key)}
                  className={`px-3 py-1 text-xs font-medium rounded-md ${
                    timeRange === key
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                  }`}
                >
                  {value.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <div className="relative h-full w-full">
            {/* Live price display - moved to top left */}
            <div className="absolute top-0 left-0 z-10 m-4">
              <div className="bg-background/80 p-4 rounded-lg text-center shadow-sm backdrop-blur-sm border border-border">
                <p className="text-3xl font-bold">{formatCurrency(stock.last_price, stock.currency_code)}</p>
                <div className={`flex items-center justify-center mt-2 text-sm ${stock.change_percentage >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {stock.change_percentage >= 0 ? (
                    <TrendingUp className="mr-1 h-4 w-4" />
                  ) : (
                    <TrendingDown className="mr-1 h-4 w-4" />
                  )}
                  {stock.change_percentage >= 0 ? '+' : ''}{stock.change_percentage.toFixed(2)}%
                </div>
              </div>
            </div>
            
            {/* Price chart using Recharts - memoized to prevent flickering */}
            <div className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                {isLoading ? (
                  <div className="h-full w-full flex items-center justify-center">
                    <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
                  </div>
                ) : priceHistory.length === 0 ? (
                  <div className="h-full w-full flex flex-col items-center justify-center">
                    <p className="text-muted-foreground">No data available for the selected time range</p>
                  </div>
                ) : renderPriceChart}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}