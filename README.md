<h1 align="center">Dither</h1>

<p align="center">사진 한 장을 점 몇 개로 다시 그리는 웹 앱입니다.</p>

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="알고리즘과 팔레트, 픽셀 크기를 바꾸며 미리보기가 바뀌는 모습" width="860" />
</p>

## 회색은 없습니다

아래 왼쪽 위 이미지에는 검정과 흰색, 딱 두 색만 쓰였습니다. 그런데도 하늘의 그라디언트와 공의 그림자가 보입니다. 점을 촘촘하게 찍으면 어둡게, 듬성듬성 찍으면 밝게 보이도록 눈을 속이는 것, 이게 디더링입니다. 옛날 신문 사진과 흑백 모니터, 초록색 게임기 화면이 모두 이 방법으로 그림을 그렸습니다.

점을 어디에 찍을지는 알고리즘마다 다릅니다. Bayer는 정해진 무늬를 깔아 규칙적인 격자를 만들고 Floyd–Steinberg와 Atkinson은 오차를 옆 픽셀로 넘기며 모래알 같은 질감을 만듭니다.

<table>
  <tr>
    <td align="center"><img src="docs/screenshots/gallery-bayer4.png" alt="Bayer 4×4, 1-bit" /><br /><sub><b>Bayer 4×4</b> · 1-bit</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-floyd-steinberg.png" alt="Floyd–Steinberg, Ink" /><br /><sub><b>Floyd–Steinberg</b> · Ink</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-atkinson.png" alt="Atkinson, Green LCD" /><br /><sub><b>Atkinson</b> · Green LCD</sub></td>
  </tr>
  <tr>
    <td align="center"><img src="docs/screenshots/gallery-halftone45.png" alt="Halftone 45°, Blueprint" /><br /><sub><b>Halftone 45°</b> · Blueprint</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-bayer8.png" alt="Bayer 8×8, Sepia" /><br /><sub><b>Bayer 8×8</b> · Sepia</sub></td>
    <td align="center"><img src="docs/screenshots/gallery-bayer2.png" alt="Bayer 2×2, Gray 4" /><br /><sub><b>Bayer 2×2</b> · Gray 4</sub></td>
  </tr>
</table>

## 어떻게 만들었나

계산과 화면을 나눴습니다. 슬라이더를 끝까지 밀어도 화면이 멈추지 않는 이유입니다.

- `src/lib/dither.ts`: 디더링 계산 전부. DOM을 모르는 순수 함수라 워커와 테스트에서 그대로 돌아갑니다.
- `src/workers/dither.worker.ts`, `src/lib/ditherClient.ts`: 계산을 백그라운드로 보내고 밀린 요청은 최신 것만 남깁니다.
- `src/components/`: 미리보기와 알고리즘·팔레트 선택 UI

## 실행

```bash
pnpm install
pnpm dev
```
