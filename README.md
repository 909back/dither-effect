<h1 align="center">Dither</h1>

<p align="center">
  사진을 디더링된 픽셀 이미지로 바꾸고 PNG로 저장하는 웹 앱입니다.<br />
  알고리즘과 팔레트를 고르면 미리보기가 바로 바뀝니다.
</p>

<p align="center">
  <img src="docs/screenshots/demo.gif" alt="알고리즘과 팔레트, 픽셀 크기를 바꾸며 미리보기가 바뀌는 모습" width="860" />
</p>

<p align="center">
  <img alt="SolidJS" src="https://img.shields.io/badge/SolidJS-1.9-2c4f7c?logo=solid&logoColor=white" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-7-3178c6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white" />
  <img alt="Vitest" src="https://img.shields.io/badge/Vitest-5-6e9f18?logo=vitest&logoColor=white" />
</p>

## 디더링이란

디더링(dithering)은 적은 수의 색으로 더 많은 색이 있는 것처럼 보이게 하는 기법입니다. 검정과 흰색 두 가지만 쓸 수 있다면 회색을 직접 칠할 수는 없습니다. 대신 검은 점과 흰 점을 섞어 배치하면 멀리서 볼 때 눈이 두 색을 평균 내어 회색으로 인식합니다. 검은 점의 비율이 높을수록 더 어두운 회색으로 보입니다.

이 기법은 화면과 인쇄 기술이 표현할 수 있는 색이 적던 시절에 널리 쓰였습니다. 신문 사진은 크기가 다른 망점으로 명암을 표현했고, 흑백 화면만 있던 초기 개인용 컴퓨터와 4단계 녹색만 표시하던 휴대용 게임기도 디더링으로 사진과 그림자를 그렸습니다. 지금은 표현할 수 있는 색이 충분하지만 디더링 특유의 거친 점 패턴은 레트로 감성을 내는 그래픽 스타일로 다시 쓰이고 있습니다.

디더링 알고리즘은 점을 어디에 찍을지 정하는 방식에 따라 크게 두 갈래로 나뉩니다.

| 방식 | 원리 | 결과의 특징 | 이 앱의 알고리즘 |
|---|---|---|---|
| 순서 디더링<br />(ordered) | 미리 정한 임계값 행렬을 이미지 위에 바둑판처럼 반복해 깔고, 픽셀 밝기가 그 자리의 임계값보다 밝은지만 비교합니다. | 규칙적인 격자 무늬가 생깁니다. 계산이 빠르고 이미지가 조금 바뀌어도 무늬가 흔들리지 않습니다. | Bayer 2×2 · 4×4 · 8×8, Halftone 45° |
| 오차 확산<br />(error diffusion) | 픽셀을 가장 가까운 색으로 바꾼 뒤 생긴 오차를 아직 처리하지 않은 이웃 픽셀에 나눠 줍니다. | 불규칙하고 자연스러운 점 분포가 생깁니다. 세부 묘사가 잘 살지만 픽셀을 순서대로 처리해야 합니다. | Floyd–Steinberg, Atkinson |

알고리즘마다 차이는 다음과 같습니다.

- **Bayer**: 1973년 Bryce Bayer가 제안한 재귀 행렬을 임계값으로 씁니다. 행렬이 클수록(2×2 → 8×8) 표현할 수 있는 명암 단계가 많아지고 무늬가 촘촘해집니다.
- **Halftone 45°**: 인쇄용 망점을 흉내 냅니다. 45도로 기울어진 격자에 점을 두고 어두운 영역일수록 점이 커집니다.
- **Floyd–Steinberg**: 1976년에 발표된 가장 대표적인 오차 확산 알고리즘입니다. 오차를 오른쪽과 아래쪽 이웃 4개에 7/16, 3/16, 5/16, 1/16 비율로 나눠 줍니다.
- **Atkinson**: 초기 Macintosh의 흑백 그래픽을 위해 Bill Atkinson이 만든 방식입니다. 이웃 6개에 오차를 1/8씩, 모두 합쳐 6/8만 나눠 주고 나머지 1/4은 버립니다. 그래서 밝은 영역과 어두운 영역이 더 깨끗하게 날아가고 대비가 강한 결과가 나옵니다.

## 기능

- **알고리즘 6종**: Bayer 2×2 · 4×4 · 8×8, Halftone 45°, Floyd–Steinberg, Atkinson
- **팔레트 프리셋 6종**: 1-bit, Ink, Green LCD, Sepia, Gray 4, Blueprint. 색은 2개에서 8개까지 직접 추가하거나 바꿀 수 있습니다.
- **조정**: 픽셀 크기(1–16), 밝기, 대비(-100–100)
- **미리보기 배율**: Fit, 1×, 2×, 4×
- **PNG 저장**: 원본 해상도로 업스케일해 `<파일명>-<알고리즘>.png`로 저장합니다.
- **Web Worker 렌더링**: 디더링은 워커에서 실행되므로 슬라이더를 움직여도 UI가 멈추지 않습니다.

![Atkinson 알고리즘과 Green LCD 팔레트를 적용한 화면](docs/screenshots/app-desktop-lcd.png)

## 알고리즘과 팔레트 예시

같은 샘플 이미지에 알고리즘과 팔레트를 다르게 적용한 결과입니다.

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

## 사용 방법

1. 앱을 열면 샘플 이미지가 바로 표시됩니다. 내 이미지를 쓰려면 **Open another image**를 누르거나 미리보기 영역에 이미지를 끌어다 놓습니다.
2. 오른쪽 패널의 **Algorithm**에서 디더링 방식을 고릅니다. 각 항목의 썸네일은 현재 팔레트로 그린 명암 그라디언트입니다.
3. **Adjust**에서 픽셀 크기, 밝기, 대비를 조절합니다.
4. **Palette**에서 프리셋을 고르거나 색을 직접 편집합니다.
5. **Save PNG**를 눌러 결과를 저장합니다. **Reset**은 모든 설정을 기본값으로 되돌립니다.

<table>
  <tr>
    <td width="68%"><img src="docs/screenshots/app-desktop.png" alt="데스크톱 화면: 미리보기와 설정 패널" /></td>
    <td width="32%"><img src="docs/screenshots/app-mobile.png" alt="모바일 화면: 미리보기 아래에 설정 패널이 이어짐" /></td>
  </tr>
  <tr>
    <td align="center"><sub>데스크톱</sub></td>
    <td align="center"><sub>모바일</sub></td>
  </tr>
</table>

## 로컬에서 실행하기

Node.js와 [pnpm](https://pnpm.io)이 필요합니다.

```bash
pnpm install
pnpm dev        # 개발 서버 (http://localhost:5173)
```

| 명령어 | 설명 |
|---|---|
| `pnpm dev` | Vite 개발 서버를 실행합니다. |
| `pnpm build` | 타입 검사 후 `dist/`에 프로덕션 빌드를 만듭니다. |
| `pnpm preview` | 빌드 결과를 로컬에서 확인합니다. |
| `pnpm test` | Vitest로 디더링 로직 테스트를 실행합니다. |

## 동작 방식

디더링 파이프라인은 `src/lib/dither.ts`에 있는 순수 함수이며 DOM에 접근하지 않습니다. 그래서 Web Worker와 Node(테스트) 양쪽에서 그대로 실행됩니다.

1. 원본을 `pixelSize` 단위 블록으로 평균 내어 축소합니다.
2. Rec.601 가중치로 휘도를 구하고 대비, 밝기 순서로 보정합니다.
3. 팔레트 색 수(N)만큼 균등한 회색 단계로 양자화합니다. Bayer와 Halftone은 순서 임계값(ordered threshold)을, Floyd–Steinberg와 Atkinson은 오차 확산(error diffusion)을 씁니다.
4. 각 단계를 어두운 색부터 밝은 색 순으로 정렬한 팔레트에 대응시킵니다.

결과는 축소된 크기로 나오고 화면과 PNG 저장 시에는 최근접 이웃(nearest-neighbor) 방식으로 확대합니다. `DitherClient`(`src/lib/ditherClient.ts`)는 한 번에 하나의 렌더만 워커에 보내고 그사이 들어온 요청은 가장 최신 것만 남깁니다.

```
src/
├── App.tsx                 레이아웃 (헤더 · 미리보기 · 설정 패널)
├── store.ts                옵션 스토어, 팔레트 프리셋, 알고리즘 이름
├── components/             AlgorithmPicker, PalettePresets, ControlPanel, PreviewCanvas, ImageDropzone
├── lib/
│   ├── dither.ts           디더링 파이프라인 (순수 함수)
│   ├── dither.test.ts      파이프라인 테스트
│   ├── ditherClient.ts     워커 래퍼
│   ├── canvas.ts           업스케일, PNG 저장
│   └── sample.ts           절차적으로 생성하는 샘플 이미지
└── workers/dither.worker.ts
```
