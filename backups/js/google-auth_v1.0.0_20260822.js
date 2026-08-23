/*
 * google-auth.js — Google OAuth 2.0 (Google Identity Services)
 * @version 1.0.0
 *
 * ⚠️ 아래 CLIENT_ID를 본인 Google Cloud Console 값으로 교체하세요
 * 발급 경로: console.cloud.google.com
 *   → API 및 서비스 → 사용자 인증 정보 → OAuth 2.0 클라이언트 ID 만들기
 *   → 애플리케이션 유형: 웹 애플리케이션
 *   → 승인된 JavaScript 출처: https://YOUR_GITHUB_PAGES_URL
 */
const _SMART_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const _SCOPE = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email'
].join(' ');

let _tokenClient  = null;
let _accessToken  = null;
let _userInfo     = null;
let _authCallback = null;

window.SmartAuth = {

  /* 초기화 — 세션 복원 시도 후 callback 호출 */
  init(callback) {
    _authCallback = callback;
    const savedToken = sessionStorage.getItem('sa_token');
    const savedUser  = sessionStorage.getItem('sa_user');
    if (savedToken && savedUser) {
      _accessToken = savedToken;
      try { _userInfo = JSON.parse(savedUser); } catch {}
      callback({ signedIn: true, user: _userInfo });
    } else {
      callback({ signedIn: false });
    }
  },

  /* GIS 클라이언트 초기화 (GIS 스크립트 로드 완료 후 호출) */
  _initClient() {
    if (_tokenClient) return;
    _tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: _SMART_CLIENT_ID,
      scope: _SCOPE,
      callback: async (resp) => {
        if (resp.error) { console.error('Google Auth error:', resp); return; }
        _accessToken = resp.access_token;
        sessionStorage.setItem('sa_token', _accessToken);
        // 사용자 정보 조회
        try {
          const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
            headers: { Authorization: `Bearer ${_accessToken}` }
          });
          _userInfo = await r.json();
          sessionStorage.setItem('sa_user', JSON.stringify(_userInfo));
        } catch (e) {
          _userInfo = { name: '사용자', picture: null };
        }
        _authCallback?.({ signedIn: true, user: _userInfo });
      }
    });
  },

  signIn() {
    this._initClient();
    _tokenClient?.requestAccessToken({ prompt: _accessToken ? '' : 'consent' });
  },

  signOut() {
    if (_accessToken) {
      try { google.accounts.oauth2.revoke(_accessToken, () => {}); } catch {}
    }
    _accessToken = null;
    _userInfo    = null;
    sessionStorage.removeItem('sa_token');
    sessionStorage.removeItem('sa_user');
    SmartDrive?.reset?.();
    _authCallback?.({ signedIn: false });
  },

  getToken()  { return _accessToken; },
  getUser()   { return _userInfo; },
  isSignedIn(){ return !!_accessToken; }
};
