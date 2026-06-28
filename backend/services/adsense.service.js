import fetch from 'node-fetch';

/**
 * Production-Ready Google AdSense Management API (v2) Integration Service
 * 
 * Configured via environment variables:
 * - ADSENSE_CLIENT_ID
 * - ADSENSE_CLIENT_SECRET
 * - ADSENSE_ACCOUNT_ID (e.g. pub-1234567890123456)
 * - ADSENSE_REFRESH_TOKEN
 */

let cachedAccessToken = null;
let tokenExpiryTime = 0;

async function getAccessToken() {
  const clientId = process.env.ADSENSE_CLIENT_ID;
  const clientSecret = process.env.ADSENSE_CLIENT_SECRET;
  const refreshToken = process.env.ADSENSE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    return null;
  }

  if (cachedAccessToken && Date.now() < tokenExpiryTime - 60000) {
    return cachedAccessToken;
  }

  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token'
      })
    });

    if (!response.ok) {
      console.error('[AdSense API] Failed to refresh OAuth token:', await response.text());
      return null;
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiryTime = Date.now() + (data.expires_in * 1000);
    return cachedAccessToken;
  } catch (err) {
    console.error('[AdSense API] OAuth token fetch error:', err.message);
    return null;
  }
}

export async function fetchAdSenseReport() {
  const accountId = process.env.ADSENSE_ACCOUNT_ID;
  const token = await getAccessToken();

  if (!accountId || !token) {
    return {
      isConfigured: false,
      totalAdRevenue: 0.00,
      rpm: 0.00,
      totalImpressions: 0
    };
  }

  try {
    // AdSense v2 API Report Endpoint
    const url = `https://adsense.googleapis.com/v2/accounts/${accountId}/reports:generate?dateRange=LAST_30_DAYS&metrics=ESTIMATED_EARNINGS,IMPRESSIONS,PAGE_VIEWS_RPM`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    });

    if (!res.ok) {
      console.error('[AdSense API] Report query failed:', await res.text());
      return { isConfigured: true, error: 'API query failed', totalAdRevenue: 0.00, rpm: 0.00, totalImpressions: 0 };
    }

    const report = await res.json();
    let totalAdRevenue = 0.00;
    let totalImpressions = 0;
    let rpm = 0.00;

    if (report.rows && report.rows.length > 0) {
      // Aggregate monthly totals from rows
      report.rows.forEach(row => {
        const cells = row.cells || [];
        totalAdRevenue += parseFloat(cells[0]?.value || 0);
        totalImpressions += parseInt(cells[1]?.value || 0, 10);
      });
      if (totalImpressions > 0) {
        rpm = (totalAdRevenue / totalImpressions) * 1000;
      }
    }

    return {
      isConfigured: true,
      totalAdRevenue: Number(totalAdRevenue.toFixed(2)),
      rpm: Number(rpm.toFixed(2)),
      totalImpressions
    };
  } catch (error) {
    console.error('[AdSense API] Execution error:', error.message);
    return { isConfigured: true, error: error.message, totalAdRevenue: 0.00, rpm: 0.00, totalImpressions: 0 };
  }
}
