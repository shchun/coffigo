# Coffigo — APK 빌드 가이드

여러 명이 손가락을 올리면 카운트다운 후 한 명을 뽑아주는 결정 게임입니다.
이 폴더(`app/`)는 **PWA**로 동작하면서 그대로 **APK**로 변환할 수 있도록 구성돼 있어요.

## 폴더 구성

```
app/
├─ index.html              ← 메인 앱 (풀스크린, 4가지 테마)
├─ touch-selector.jsx      ← 게임 로직 (멀티터치, 카운트다운, 컨페티)
├─ manifest.webmanifest    ← PWA 매니페스트
├─ sw.js                   ← 서비스 워커 (오프라인 캐시)
├─ icon.svg                ← 마스터 아이콘
├─ icon-192.png            ← 192×192 PNG
├─ icon-512.png            ← 512×512 PNG
├─ icon-maskable-512.png   ← Android adaptive icon
└─ apple-touch-icon.png    ← iOS 홈 화면 아이콘
```

## 1단계 — 호스팅하기

PWA → APK 변환은 **공개 HTTPS URL**이 필요합니다.
무료 호스팅 옵션:

- **GitHub Pages**: `app/` 폴더를 레포에 push → Pages 활성화
- **Netlify Drop**: https://app.netlify.com/drop 에 `app/` 폴더 드래그
- **Vercel**: `vercel deploy` (CLI 한 줄)
- **Cloudflare Pages**: 비슷한 방식

호스팅 후 `https://your-domain/manifest.webmanifest` 가 열리는지 확인.

## 2단계 (가장 쉬움) — PWABuilder로 APK 만들기

1. https://www.pwabuilder.com 접속
2. PWA URL 입력 (예: `https://yourname.github.io/coffigo/`)
3. "Package For Stores" → **Android** 선택
4. 옵션 그대로 두고 **Generate Package** → ZIP 다운로드
5. ZIP 안에 `app-release-signed.apk` 가 들어 있음

내부적으로 Google의 **Bubblewrap**(TWA, Trusted Web Activity)을 사용합니다.

## 2단계 (대안) — Capacitor로 진짜 네이티브 래퍼

WebView로 HTML을 감싸 완전한 네이티브 APK를 만들고 싶다면:

```bash
mkdir coffigo-native && cd coffigo-native
npm init -y
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Coffigo" "com.coffigo.app" --web-dir=www
mkdir www && cp -R ../app/* www/
npx cap add android
npx cap sync
npx cap open android   # Android Studio가 열림
```

Android Studio에서:
- **Build → Build Bundle(s) / APK(s) → Build APK(s)**
- 생성된 APK 위치가 알림으로 표시됨

## 3단계 — 단말에 설치 (Sideload)

### 방법 A: USB + adb
```bash
adb install app-release-signed.apk
```

### 방법 B: 파일 전송
1. APK를 폰으로 옮기기 (카톡, USB, Drive 등)
2. 폰 **설정 → 보안 → 출처를 알 수 없는 앱 → Chrome/파일 매니저 허용**
3. APK 탭 → 설치

## 호스팅 없이 미리 테스트하기

호스팅 전에 **모바일 Chrome**에서 직접 PWA로 테스트할 수 있습니다:

1. `app/index.html` 을 로컬 서버로 실행 (예: `npx serve app`)
2. 같은 Wi-Fi의 폰 Chrome에서 접속
3. 메뉴 → **홈 화면에 추가** → 앱처럼 풀스크린 실행

> 단, 일부 기능(서비스 워커, 진동, Wake Lock)은 **HTTPS** 또는 `localhost`에서만 동작합니다.

## 주요 기능

- 4가지 테마 (POP / NEON / AURORA / KAWAII) — 설정에서 전환
- 멀티터치 — 손가락 수만큼 회전하는 링이 표시됨
- 자동 카운트다운 — 2개 이상 손가락이 올라가면 ~2.8초 후 추첨
- 당첨 연출 — 극적인 줌인 + 컨페티 폭죽 + 사운드(Web Audio) + 진동
- 풀스크린 + Wake Lock — 화면이 꺼지지 않음
- 오프라인 지원 — 한 번 로드 후 인터넷 없이도 실행

## 라이선스 / 변경

마음껏 수정해서 쓰세요. 패키지명, 앱 이름, 아이콘은 `manifest.webmanifest` 와 `index.html` 의 `<title>` 만 바꾸면 됩니다.
