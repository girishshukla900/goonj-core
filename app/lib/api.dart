import 'dart:convert';
import 'package:http/http.dart' as http;

/// Thin API client for the Goonj backend.
/// Set the base URL to your machine's LAN IP when running on a device.
class GoonjApi {
  GoonjApi({this.baseUrl = 'http://localhost:4000'});

  final String baseUrl;
  String? _token;

  void setToken(String token) => _token = token;

  Map<String, String> get _headers => {
        'content-type': 'application/json',
        if (_token != null) 'authorization': 'Bearer $_token',
      };

  Future<Map<String, dynamic>> requestOtp(String phone) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/otp'),
      headers: _headers,
      body: jsonEncode({'phone': phone}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<String> verifyOtp(String phone, String code) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/auth/verify'),
      headers: _headers,
      body: jsonEncode({'phone': phone, 'code': code}),
    );
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    final token = body['token'] as String;
    setToken(token);
    return token;
  }

  /// Regional-first feed. [lang] is the viewer's content language.
  Future<List<Map<String, dynamic>>> feed({String? lang, String? region}) async {
    final uri = Uri.parse('$baseUrl/v1/feed').replace(queryParameters: {
      if (lang != null) 'lang': lang,
      if (region != null) 'region': region,
    });
    final res = await http.get(uri, headers: _headers);
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return (body['items'] as List).cast<Map<String, dynamic>>();
  }

  Future<Map<String, dynamic>> createVideo(String title, String sourceLang) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/videos'),
      headers: _headers,
      body: jsonEncode({'title': title, 'source_lang': sourceLang}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }

  Future<Map<String, dynamic>> requestDubs(String videoId, List<String> langs) async {
    final res = await http.post(
      Uri.parse('$baseUrl/v1/videos/$videoId/dubs'),
      headers: _headers,
      body: jsonEncode({'target_langs': langs}),
    );
    return jsonDecode(res.body) as Map<String, dynamic>;
  }
}
