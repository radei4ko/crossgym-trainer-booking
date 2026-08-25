# CrossGYM Trainer Booking — Telegram Mini App

Telegram Mini App for booking group CrossFit sessions at CrossGYM clubs (Kryvyi Rih).
Vanilla JS/CSS frontend, no build step — talks to an n8n webhook backend for booking,
schedule, and cancellation.

## Screenshots

<p>
  <img src="site/screenshots/home.png" width="260" alt="Home screen">
  <img src="site/screenshots/schedule.png" width="260" alt="Club schedule">
  <img src="site/screenshots/booking.png" width="260" alt="Booking confirmation">
</p>

## Features

- Browse clubs, see live open/closed status based on working hours
- Book a session, view "my bookings", cancel anytime
- Telegram CloudStorage for persistence across app reopens (falls back to localStorage)
- Admin view gated by Telegram user ID, for managing the schedule

## Stack

- Frontend: static HTML/CSS/JS, Telegram Web App SDK
- Backend: n8n workflows exposed as webhooks (booking, schedule, cancel, admin)

## Structure

```
site/
  index.html
  style.css
  app.js
  trainer.jpg
```
