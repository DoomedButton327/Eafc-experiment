/* ═══════════════════════════════════════════════════════════════
   METTLESTATE — discord.js
   Enhanced Discord webhook logging system
   Events: result, postponement, forfeit, noshow, fixture-gen,
           draw-gen, auto-gen, season-start, player-join,
           player-remove, suspension, page-load, error, etc.
═══════════════════════════════════════════════════════════════ */

const Discord = (() => {
  'use strict';

  const COLORS = {
    acid:    0xC8F135,
    cyan:    0x00E5FF,
    green:   0x32D74B,
    red:     0xFF2D55,
    orange:  0xFF9500,
    gold:    0xFFD60A,
    purple:  0xBF5AF2,
    blue:    0x0078D4,
    white:   0xFFFFFF,
    grey:    0x5E5A78,
  };

  function getWebhookUrl() {
    return localStorage.getItem('eafc_discord_webhook') || '';
  }

  function setWebhookUrl(url) {
    localStorage.setItem('eafc_discord_webhook', url.trim());
  }

  function getCurrentSeason() {
    return localStorage.getItem('eafc_current_season') || 's1';
  }

  function footer() {
    return { text: '🎮 Mettlestate × EA FC League · SAST (GMT+2)' };
  }

  function timestamp() {
    return new Date().toISOString();
  }

  function sastTime() {
    const now = new Date();
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const sast  = new Date(utcMs + 7200000);
    return sast.toLocaleTimeString('en-ZA', { hour:'2-digit', minute:'2-digit' }) + ' SAST';
  }

  // ── BUILD EMBED BY EVENT TYPE ─────────────────────────────────
  function buildEmbed(data) {
    const season = getCurrentSeason().toUpperCase();
    const time   = sastTime();

    switch (data.type) {

      case 'result':
        return {
          title: '⚽ Match Result Logged',
          description: `**${data.home}** \`${data.score}\` **${data.away}**`,
          color: COLORS.cyan,
          fields: [
            { name: 'Home', value: data.home,   inline: true },
            { name: 'Away', value: data.away,   inline: true },
            { name: 'Result', value: data.result === 'home' ? `🏆 ${data.home}` : data.result === 'away' ? `🏆 ${data.away}` : '🤝 Draw', inline: true },
            { name: 'Score', value: `\`${data.score}\``, inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'postponement':
        return {
          title: '⏸️ Match Postponed',
          description: `**${data.player}** requested a postponement`,
          color: COLORS.orange,
          fields: [
            { name: 'Player', value: data.player, inline: true },
            { name: 'Match', value: data.match || 'N/A', inline: true },
            { name: 'Remaining', value: `${data.remaining}/20`, inline: true },
            { name: 'Reason', value: data.reason || 'Not specified', inline: false },
            { name: 'Season', value: season, inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'auto_forfeit':
        return {
          title: '🚫 AUTO-FORFEIT: No Postponements Left',
          description: `**${data.player}** attempted to postpone but has used all 20 postponements this season.\nMatch **${data.match}** auto-forfeited — opponent awarded 3-0.`,
          color: COLORS.red,
          fields: [
            { name: 'Forfeiting Player', value: data.player, inline: true },
            { name: 'Match', value: data.match, inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'forfeit':
        return {
          title: '🏳️ Match Forfeited',
          description: `**${data.forfeiter}** forfeited → **${data.winner}** wins 3-0`,
          color: COLORS.gold,
          fields: [
            { name: 'Winner',   value: data.winner,   inline: true },
            { name: 'Forfeiter', value: data.forfeiter, inline: true },
            { name: 'Score',    value: data.score,    inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'noshow':
        return {
          title: '⚡ No-Show · Auto Win Awarded',
          description: `**${data.winner}** awarded 3-0 win — **${data.noshow}** did not show up`,
          color: COLORS.green,
          fields: [
            { name: 'Winner',  value: data.winner,  inline: true },
            { name: 'No-Show', value: data.noshow,  inline: true },
            { name: 'Score',   value: data.score,   inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'fixture_gen':
        return {
          title: '🔀 Fixtures Generated',
          description: `**${data.count}** new fixture${data.count !== 1 ? 's' : ''} created (${data.mode || 'Random'} mode)`,
          color: COLORS.acid,
          fields: [
            { name: 'Count',  value: String(data.count),     inline: true },
            { name: 'Mode',   value: data.mode || 'Random',  inline: true },
            { name: 'By',     value: data.by   || 'Admin',   inline: true },
            { name: 'Season', value: season,                  inline: true },
            { name: 'Time',   value: time,                    inline: true },
            ...(data.fixtures ? [{ name: 'Matches', value: data.fixtures.slice(0,10).map(f=>`• ${f.home} vs ${f.away}`).join('\n') || 'None', inline: false }] : []),
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'draw_gen':
        return {
          title: '🎲 Auto-Draw Generated',
          description: `**${data.count}** match${data.count !== 1 ? 'es' : ''} auto-drawn at 2:00 AM SAST`,
          color: COLORS.purple,
          fields: [
            { name: 'Matches Generated', value: String(data.count), inline: true },
            { name: 'Skipped (Postponed)', value: String(data.skipped || 0), inline: true },
            { name: 'Skipped (Ignored)',   value: String(data.ignored || 0), inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time',   value: time,   inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'auto_schedule':
        return {
          title: '⏰ Automated Scheduler Ran',
          description: `Automated ${data.action} at \`${time}\``,
          color: COLORS.blue,
          fields: [
            { name: 'Action',  value: data.action,        inline: true },
            { name: 'Result',  value: data.result || 'OK', inline: true },
            { name: 'Season',  value: season,              inline: true },
            { name: 'Time',    value: time,                inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'season_start':
        return {
          title: '🏆 New Season Started!',
          description: `**${data.seasonName}** has officially begun. All stats reset. Let the games begin!`,
          color: COLORS.acid,
          fields: [
            { name: 'Season', value: data.seasonName, inline: true },
            { name: 'Players', value: String(data.playerCount), inline: true },
            { name: 'Previous Season', value: data.previousSeason || 'None', inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'player_add':
        return {
          title: '👤 Player Added to League',
          description: `**${data.name}** (${data.username}) has been added to ${season}`,
          color: COLORS.green,
          fields: [
            { name: 'Full Name', value: data.name,     inline: true },
            { name: 'Username',  value: data.username, inline: true },
            { name: 'Phone',     value: data.phone || 'N/A', inline: true },
            { name: 'Total Players', value: String(data.totalPlayers || '?'), inline: true },
            { name: 'Time', value: time, inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'player_remove':
        return {
          title: '❌ Player Removed',
          description: `**${data.username}** has been removed from the league`,
          color: COLORS.red,
          fields: [
            { name: 'Username', value: data.username, inline: true },
            { name: 'Season',   value: season,        inline: true },
            { name: 'Time',     value: time,          inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'suspension':
        return {
          title: data.suspended ? '🚫 Player Suspended' : '▶️ Player Reactivated',
          description: `**${data.player}** has been ${data.suspended ? 'suspended' : 'reactivated'}`,
          color: data.suspended ? COLORS.red : COLORS.green,
          fields: [
            { name: 'Player', value: data.player, inline: true },
            { name: 'Status', value: data.suspended ? 'SUSPENDED' : 'ACTIVE', inline: true },
            { name: 'Season', value: season, inline: true },
            { name: 'Time',   value: time,   inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'signup_request':
        return {
          title: '📋 New Player Signup Request',
          description: `**${data.name}** wants to join the Mettlestate League!`,
          color: COLORS.purple,
          fields: [
            { name: 'Full Name',       value: data.name,      inline: true },
            { name: 'EAFC Username',   value: data.username,  inline: true },
            { name: 'WhatsApp Name',   value: data.waName,    inline: true },
            { name: 'Phone',           value: data.phone,     inline: true },
            { name: 'Country',         value: data.country || 'ZA', inline: true },
            { name: 'Rules Accepted',  value: '✅ Yes',       inline: true },
            { name: 'Submitted At',    value: time,           inline: false },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'leaderboard_push':
        return {
          title: '📊 Public Leaderboard Updated',
          description: `Live standings pushed to public GitHub Pages`,
          color: COLORS.cyan,
          fields: [
            { name: 'Season', value: season, inline: true },
            { name: 'Time',   value: time,   inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'github_sync':
        return {
          title: '☁️ Data Synced to GitHub',
          description: data.message || 'League data committed to repository',
          color: COLORS.grey,
          fields: [
            { name: 'Season', value: season, inline: true },
            { name: 'Time',   value: time,   inline: true },
          ],
          footer: footer(), timestamp: timestamp(),
        };

      case 'page_load':
        return null; // Silent — don't log page loads to avoid spam

      default:
        return null;
    }
  }

  // ── SEND WEBHOOK ───────────────────────────────────────────────
  async function send(data) {
    const url = getWebhookUrl();
    if (!url) return false;

    const embed = buildEmbed(data);
    if (!embed) return false;

    try {
      const formData = new FormData();
      const payload = { embeds: [embed] };

      // Attach image if present
      if (data.imageDataUrl && data.imageDataUrl.startsWith('data:')) {
        try {
          const blob = await (await fetch(data.imageDataUrl)).blob();
          formData.append('file', blob, 'evidence.png');
        } catch(e) {}
      }

      formData.append('payload_json', JSON.stringify(payload));
      const res = await fetch(url, { method: 'POST', body: formData });
      return res.ok || res.status === 204;
    } catch(e) {
      console.warn('[Discord] Webhook send failed:', e);
      return false;
    }
  }

  // Test webhook
  async function test(url) {
    const testUrl = url || getWebhookUrl();
    if (!testUrl) return { ok: false, msg: 'No webhook URL configured' };
    try {
      const embed = {
        title: '🎮 Webhook Connected!',
        description: 'Your Mettlestate League Manager is now connected to this Discord channel.',
        color: COLORS.acid,
        fields: [
          { name: 'Status',  value: '✅ Online',   inline: true },
          { name: 'System',  value: 'League Manager v4', inline: true },
          { name: 'Time',    value: sastTime(),    inline: true },
        ],
        footer: footer(),
        timestamp: new Date().toISOString(),
      };
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify({ embeds: [embed] }));
      const res = await fetch(testUrl, { method: 'POST', body: fd });
      return { ok: res.ok || res.status === 204, msg: res.ok ? 'Connected!' : 'Status: ' + res.status };
    } catch(e) {
      return { ok: false, msg: 'Network error: ' + e.message };
    }
  }

  return { send, test, getWebhookUrl, setWebhookUrl, COLORS };
})();

// Backwards-compatible global for God.html code
async function sendDiscordWebhook(data) {
  return Discord.send(data);
}
