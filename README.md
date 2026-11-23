# Dither

이미지에 디더링을 적용하고 PNG로 저장하는 웹 앱입니다. SolidJS와 Vite로 만들었습니다.

<img src="docs/screenshots/demo.gif" alt="알고리즘과 팔레트, 픽셀 크기를 바꾸며 미리보기가 바뀌는 모습" width="860" />

## 디더링

팔레트에 있는 몇 가지 색만으로 이미지를 그릴 때 중간 톤을 점의 밀도로 표현하는 방법입니다. 예를 들어 검정과 흰색만 있는 1-bit 팔레트에서는 회색 영역을 검은 점과 흰 점을 섞어서 그립니다.

이 앱의 알고리즘은 두 종류입니다.

- Bayer, Halftone: 픽셀 위치마다 정해진 임계값과 밝기를 비교합니다. 결과에 일정한 격자 패턴이 남습니다.
- Floyd–Steinberg, Atkinson: 픽셀 색을 정하면서 생긴 오차를 아직 처리하지 않은 주변 픽셀에 더합니다. 패턴이 덜 규칙적입니다.

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/gallery-bayer4.png" alt="Bayer 4×4, 1-bit" /><br /><sub>Bayer 4×4 · 1-bit</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-floyd-steinberg.png" alt="Floyd–Steinberg, Ink" /><br /><sub>Floyd–Steinberg · Ink</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-atkinson.png" alt="Atkinson, Green LCD" /><br /><sub>Atkinson · Green LCD</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/gallery-halftone45.png" alt="Halftone 45°, Blueprint" /><br /><sub>Halftone 45° · Blueprint</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-bayer8.png" alt="Bayer 8×8, Sepia" /><br /><sub>Bayer 8×8 · Sepia</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-bayer2.png" alt="Bayer 2×2, Gray 4" /><br /><sub>Bayer 2×2 · Gray 4</sub></td>
  </tr>
</table>

## 파일 구조

디더링 계산은 DOM을 쓰지 않는 함수로 분리해서 Web Worker에서 실행합니다.

- `src/lib/dither.ts`: 디더링 계산. 테스트(`dither.test.ts`)도 이 함수를 그대로 씁니다.
- `src/workers/dither.worker.ts`: 워커에서 `dither()`를 호출합니다.
- `src/lib/ditherClient.ts`: 메인 스레드에서 워커로 요청을 보냅니다. 계산 중에 새 요청이 여러 개 오면 마지막 것만 처리합니다.
- `src/lib/canvas.ts`: 결과를 원본 크기로 확대하고 PNG로 저장합니다.
- `src/components/`: 미리보기, 알고리즘과 팔레트 선택, 슬라이더

## 실행

```bash
pnpm install
pnpm dev
```
