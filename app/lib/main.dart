import 'package:flutter/material.dart';
import 'api.dart';

void main() => runApp(const GoonjApp());

const _saffron = Color(0xFFDD7A1A);
const _navy = Color(0xFF152742);

class GoonjApp extends StatelessWidget {
  const GoonjApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Goonj',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: _saffron),
        useMaterial3: true,
      ),
      home: const RootShell(),
    );
  }
}

class RootShell extends StatefulWidget {
  const RootShell({super.key});
  @override
  State<RootShell> createState() => _RootShellState();
}

class _RootShellState extends State<RootShell> {
  int _index = 0;
  final api = GoonjApi();

  static const _titles = ['Home', 'Shorts', 'Live', 'Clubs', 'Studio'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text('Goonj  ·  ${_titles[_index]}'),
        backgroundColor: _navy,
        foregroundColor: Colors.white,
      ),
      body: IndexedStack(
        index: _index,
        children: [
          FeedScreen(api: api),
          const _Placeholder(label: 'Shorts + AI Clip Factory'),
          const _Placeholder(label: 'Live + Simulcast'),
          const _Placeholder(label: 'Fan Clubs'),
          const _Placeholder(label: 'Creator Studio'),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), label: 'Home'),
          NavigationDestination(icon: Icon(Icons.smart_display_outlined), label: 'Shorts'),
          NavigationDestination(icon: Icon(Icons.sensors), label: 'Live'),
          NavigationDestination(icon: Icon(Icons.groups_outlined), label: 'Clubs'),
          NavigationDestination(icon: Icon(Icons.video_call_outlined), label: 'Studio'),
        ],
      ),
    );
  }
}

/// Regional-first feed. Phase 0: the backend returns an empty list.
class FeedScreen extends StatefulWidget {
  const FeedScreen({super.key, required this.api});
  final GoonjApi api;

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  late Future<List<Map<String, dynamic>>> _future;

  @override
  void initState() {
    super.initState();
    _future = widget.api.feed(lang: 'hi');
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _future,
      builder: (context, snap) {
        if (snap.connectionState != ConnectionState.done) {
          return const Center(child: CircularProgressIndicator());
        }
        if (snap.hasError) {
          return _EmptyState(
            message: 'Cannot reach the API.\nStart the backend: cd backend && npm start',
            detail: '${snap.error}',
          );
        }
        final items = snap.data ?? [];
        if (items.isEmpty) {
          return const _EmptyState(
            message: 'Feed is empty (Phase 0).\nVideos appear here once upload + feed queries land.',
          );
        }
        return ListView.builder(
          itemCount: items.length,
          itemBuilder: (context, i) => ListTile(
            leading: const Icon(Icons.play_circle_outline),
            title: Text('${items[i]['title'] ?? 'Untitled'}'),
            subtitle: Text('${items[i]['source_lang'] ?? ''}'),
          ),
        );
      },
    );
  }
}

class _Placeholder extends StatelessWidget {
  const _Placeholder({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.construction, size: 40, color: _saffron),
          const SizedBox(height: 12),
          Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          const Text('Coming in a later phase', style: TextStyle(color: Colors.grey)),
        ],
      ),
    );
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({required this.message, this.detail});
  final String message;
  final String? detail;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.wifi_tethering, size: 40, color: _saffron),
            const SizedBox(height: 12),
            Text(message, textAlign: TextAlign.center),
            if (detail != null) ...[
              const SizedBox(height: 8),
              Text(detail!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.grey, fontSize: 12)),
            ],
          ],
        ),
      ),
    );
  }
}
