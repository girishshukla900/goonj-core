# Goonj app (Flutter)

One codebase for Android, iOS and Web.

```bash
flutter create .          # generate platform folders (first time only)
flutter pub get
flutter run               # add --dart-define for API base URL if needed
```

The app talks to the backend in `../backend`. When running on a physical
device, point `GoonjApi(baseUrl: ...)` at your machine's LAN IP.

Phase 0 ships: bottom navigation (Home, Shorts, Live, Clubs, Studio), an API
client (OTP login, feed, create video, request dubs), and a Home feed screen.
Other tabs are placeholders for later phases.
