# BenefitBeacon introduction video

This folder produces a narrated, captioned, 1080p infographic video for presentations, websites, social posts, and constituent outreach.

## Deliverable

- `BenefitBeacon-introduction.mp4` — 1 minute 27 seconds, 1920×1080, H.264 video with AAC audio

The story opens with three carefully scoped indicators of unclaimed money and assistance, explains the resident problem, introduces BenefitBeacon, demonstrates the discovery journey, summarizes the technical stack, and ends with the call to action.

## Rebuild

The renderer uses local macOS narration, Pillow, NumPy, and the FFmpeg binary supplied by `imageio-ffmpeg`.

```bash
cd collateral-video
.venv/bin/python render_video.py
```

The script regenerates the narration, synthesized ambient audio, preview frames, and final MP4. Edit `NARRATION` and `CAPTIONS` in `render_video.py` together so the spoken and on-screen story remain aligned. The readable narration is also kept in `narration.txt`.

## Claim notes

- “52 programs” reflects the current Sunnyvale resident-facing catalog displayed by the application.
- Sunnyvale does not publish an official citywide dollar estimate for missed public-benefit enrollment. The video presents that missing measurement as a visibility gap rather than substituting unclaimed property.
- California's 2024 ACR 132 legislative analysis says eligible households leave billions of dollars in tax credits unclaimed each year; it does not provide a precise official total.
- The IRS estimated `$4.7B` in EITC went unclaimed in tax year 2019 and reports that approximately one in five eligible taxpayers does not claim the credit.
- These indicators use different scopes and time periods. The video explicitly says they are not additive.
- The video states that program administrators make final eligibility and award decisions.

Sources: [City of Sunnyvale public-benefit and financial materials](https://www.sunnyvale.ca.gov/your-government/governance/city-budget), [California Senate ACR 132 analysis](https://sfa.senate.ca.gov/sites/sfa.senate.ca.gov/files/packet/trp_7.1.24.pdf), [IRS unclaimed EITC research](https://www.irs.gov/pub/irs-soi/24rpeitcunderclaimsty2021census.pdf), and [IRS EITC participation information](https://www.irs.gov/newsroom/irs-joins-national-partners-to-launch-eitc-awareness-day).
