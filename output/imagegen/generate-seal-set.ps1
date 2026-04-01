$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

Add-Type -AssemblyName System.Drawing

$baseDir = "C:\Users\jshmi\Downloads\logiSSign\output\imagegen\seal-set"
$corporateDir = Join-Path $baseDir "corporate"
$personalDir = Join-Path $baseDir "personal"
$previewDir = Join-Path $baseDir "preview"
$dirs = @($baseDir, $corporateDir, $personalDir, $previewDir)
foreach ($dir in $dirs) {
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

function U {
  param([int[]]$Codes)
  return (-join ($Codes | ForEach-Object { [char]$_ }))
}

function Get-InstalledFontName {
  param([string[]]$Candidates)

  $collection = New-Object System.Drawing.Text.InstalledFontCollection
  foreach ($candidate in $Candidates) {
    if ($collection.Families.Name -contains $candidate) {
      return $candidate
    }
  }
  return "Malgun Gothic"
}

function New-Font {
  param(
    [string[]]$Candidates,
    [float]$Size,
    [System.Drawing.FontStyle]$Style = [System.Drawing.FontStyle]::Bold
  )

  $name = Get-InstalledFontName -Candidates $Candidates
  return New-Object System.Drawing.Font($name, $Size, $Style, [System.Drawing.GraphicsUnit]::Pixel)
}

function Get-RedBrush {
  $red = [System.Drawing.Color]::FromArgb(201, 25, 36)
  return New-Object System.Drawing.SolidBrush($red)
}

function Get-RedPen {
  param([float]$Width)

  $red = [System.Drawing.Color]::FromArgb(201, 25, 36)
  $pen = New-Object System.Drawing.Pen($red, $Width)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  return $pen
}

function New-StringFormatCenter {
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  return $format
}

function Draw-Border {
  param(
    [System.Drawing.Graphics]$Graphics,
    [hashtable]$Variant
  )

  $outerPen = Get-RedPen -Width $Variant.BorderWidth
  $innerPen = if ($Variant.BorderStyle -eq "double") { Get-RedPen -Width ([math]::Max(6, $Variant.BorderWidth / 4)) } else { $null }

  try {
    switch ($Variant.Shape) {
      "round" {
        $Graphics.DrawEllipse($outerPen, 104, 104, 816, 816)
        if ($innerPen) { $Graphics.DrawEllipse($innerPen, 152, 152, 720, 720) }
      }
      "square" {
        $Graphics.DrawRectangle($outerPen, 146, 146, 732, 732)
        if ($innerPen) { $Graphics.DrawRectangle($innerPen, 192, 192, 640, 640) }
      }
      "rounded_square" {
        $path = New-Object System.Drawing.Drawing2D.GraphicsPath
        $radius = 88
        $x = 142; $y = 142; $w = 740; $h = 740
        $path.AddArc($x, $y, $radius, $radius, 180, 90)
        $path.AddArc($x + $w - $radius, $y, $radius, $radius, 270, 90)
        $path.AddArc($x + $w - $radius, $y + $h - $radius, $radius, $radius, 0, 90)
        $path.AddArc($x, $y + $h - $radius, $radius, $radius, 90, 90)
        $path.CloseFigure()
        $Graphics.DrawPath($outerPen, $path)

        if ($innerPen) {
          $path2 = New-Object System.Drawing.Drawing2D.GraphicsPath
          $radius2 = 64
          $x2 = 188; $y2 = 188; $w2 = 648; $h2 = 648
          $path2.AddArc($x2, $y2, $radius2, $radius2, 180, 90)
          $path2.AddArc($x2 + $w2 - $radius2, $y2, $radius2, $radius2, 270, 90)
          $path2.AddArc($x2 + $w2 - $radius2, $y2 + $h2 - $radius2, $radius2, $radius2, 0, 90)
          $path2.AddArc($x2, $y2 + $h2 - $radius2, $radius2, $radius2, 90, 90)
          $path2.CloseFigure()
          $Graphics.DrawPath($innerPen, $path2)
          $path2.Dispose()
        }

        $path.Dispose()
      }
      "oval" {
        $Graphics.DrawEllipse($outerPen, 92, 206, 840, 612)
        if ($innerPen) { $Graphics.DrawEllipse($innerPen, 138, 246, 748, 532) }
      }
      "tall_rect" {
        $Graphics.DrawRectangle($outerPen, 258, 112, 508, 800)
        if ($innerPen) { $Graphics.DrawRectangle($innerPen, 296, 152, 432, 720) }
      }
      default {
        throw "Unknown shape: $($Variant.Shape)"
      }
    }
  }
  finally {
    $outerPen.Dispose()
    if ($innerPen) { $innerPen.Dispose() }
  }
}

function Draw-CenterGrid {
  param(
    [System.Drawing.Graphics]$Graphics,
    [hashtable]$Variant
  )

  if (-not $Variant.ShowGrid) { return }

  $pen = Get-RedPen -Width $Variant.GridWidth
  try {
    switch ($Variant.Shape) {
      "round" { $rect = [System.Drawing.Rectangle]::new(302, 300, 420, 420) }
      "square" { $rect = [System.Drawing.Rectangle]::new(252, 252, 520, 520) }
      "rounded_square" { $rect = [System.Drawing.Rectangle]::new(264, 264, 496, 496) }
      "oval" { $rect = [System.Drawing.Rectangle]::new(270, 290, 484, 444) }
      "tall_rect" { $rect = [System.Drawing.Rectangle]::new(338, 208, 348, 612) }
      default { $rect = [System.Drawing.Rectangle]::new(300, 300, 424, 424) }
    }

    $Graphics.DrawRectangle($pen, $rect)
    if ($Variant.Layout -eq "grid4") {
      $Graphics.DrawLine($pen, $rect.Left + ($rect.Width / 2), $rect.Top, $rect.Left + ($rect.Width / 2), $rect.Bottom)
      $Graphics.DrawLine($pen, $rect.Left, $rect.Top + ($rect.Height / 2), $rect.Right, $rect.Top + ($rect.Height / 2))
    }
  }
  finally {
    $pen.Dispose()
  }
}

function Draw-TextLayout {
  param(
    [System.Drawing.Graphics]$Graphics,
    [hashtable]$Variant,
    [string]$Text
  )

  $brush = Get-RedBrush
  $format = New-StringFormatCenter
  $font = New-Font -Candidates $Variant.FontCandidates -Size $Variant.FontSize
  $smallFont = if ($Variant.SmallFontSize) { New-Font -Candidates @("Malgun Gothic", "Batang", "Gulim") -Size $Variant.SmallFontSize } else { $null }

  try {
    if ($Variant.TopLabel) {
      $rectTop = [System.Drawing.RectangleF]::new(160, 132, 704, 76)
      if ($Variant.Shape -eq "oval") { $rectTop = [System.Drawing.RectangleF]::new(150, 236, 724, 72) }
      $Graphics.DrawString($Variant.TopLabel, $smallFont, $brush, $rectTop, $format)
    }

    if ($Variant.BottomLabel) {
      $rectBottom = [System.Drawing.RectangleF]::new(240, 814, 544, 58)
      if ($Variant.Shape -eq "oval") { $rectBottom = [System.Drawing.RectangleF]::new(240, 690, 544, 58) }
      if ($Variant.Shape -eq "tall_rect") { $rectBottom = [System.Drawing.RectangleF]::new(306, 836, 412, 44) }
      $Graphics.DrawString($Variant.BottomLabel, $smallFont, $brush, $rectBottom, $format)
    }

    switch ($Variant.Layout) {
      "grid4" {
        $chars = $Text.ToCharArray()
        $positions = @(
          @{X=416; Y=400},
          @{X=608; Y=400},
          @{X=416; Y=608},
          @{X=608; Y=608}
        )
        if ($Variant.Shape -eq "square") {
          $positions = @(
            @{X=392; Y=392},
            @{X=632; Y=392},
            @{X=392; Y=632},
            @{X=632; Y=632}
          )
        }
        elseif ($Variant.Shape -eq "rounded_square") {
          $positions = @(
            @{X=398; Y=398},
            @{X=626; Y=398},
            @{X=398; Y=626},
            @{X=626; Y=626}
          )
        }
        elseif ($Variant.Shape -eq "oval") {
          $positions = @(
            @{X=410; Y=412},
            @{X=614; Y=412},
            @{X=410; Y=616},
            @{X=614; Y=616}
          )
        }

        for ($i = 0; $i -lt [Math]::Min(4, $chars.Length); $i++) {
          $rect = [System.Drawing.RectangleF]::new($positions[$i].X - 72, $positions[$i].Y - 72, 144, 144)
          $Graphics.DrawString([string]$chars[$i], $font, $brush, $rect, $format)
        }
      }
      "vertical4" {
        $chars = $Text.ToCharArray()
        $positions = @(280, 428, 576, 724)
        foreach ($index in 0..([Math]::Min(3, $chars.Length - 1))) {
          $rect = [System.Drawing.RectangleF]::new(410, $positions[$index] - 60, 204, 120)
          $Graphics.DrawString([string]$chars[$index], $font, $brush, $rect, $format)
        }
      }
      "horizontal" {
        $rect = [System.Drawing.RectangleF]::new(180, 420, 664, 180)
        if ($Variant.Shape -eq "oval") {
          $rect = [System.Drawing.RectangleF]::new(148, 396, 728, 190)
        }
        $Graphics.DrawString($Text, $font, $brush, $rect, $format)
      }
      default {
        throw "Unknown layout: $($Variant.Layout)"
      }
    }
  }
  finally {
    $brush.Dispose()
    $font.Dispose()
    $format.Dispose()
    if ($smallFont) { $smallFont.Dispose() }
  }
}

function New-SealPng {
  param(
    [hashtable]$Variant,
    [string]$OutPath
  )

  $bmp = New-Object System.Drawing.Bitmap 1024, 1024
  $bmp.MakeTransparent()
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::Transparent)

  try {
    $graphics.TranslateTransform(512, 512)
    $graphics.RotateTransform([single]$Variant.Rotate)
    $graphics.TranslateTransform(-512, -512)

    Draw-Border -Graphics $graphics -Variant $Variant
    Draw-CenterGrid -Graphics $graphics -Variant $Variant
    Draw-TextLayout -Graphics $graphics -Variant $Variant -Text $Variant.Text

    $graphics.ResetTransform()
    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $graphics.Dispose()
    $bmp.Dispose()
  }
}

function Get-SvgShapeMarkup {
  param([hashtable]$Variant)

  switch ($Variant.Shape) {
    "round" {
      $outer = '<circle cx="512" cy="512" r="408" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f $Variant.BorderWidth
      $inner = if ($Variant.BorderStyle -eq "double") { '<circle cx="512" cy="512" r="360" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f [math]::Max(6, $Variant.BorderWidth / 4) } else { "" }
      return "$outer`n$inner"
    }
    "square" {
      $outer = '<rect x="146" y="146" width="732" height="732" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f $Variant.BorderWidth
      $inner = if ($Variant.BorderStyle -eq "double") { '<rect x="192" y="192" width="640" height="640" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f [math]::Max(6, $Variant.BorderWidth / 4) } else { "" }
      return "$outer`n$inner"
    }
    "rounded_square" {
      $outer = '<rect x="142" y="142" width="740" height="740" rx="88" ry="88" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f $Variant.BorderWidth
      $inner = if ($Variant.BorderStyle -eq "double") { '<rect x="188" y="188" width="648" height="648" rx="64" ry="64" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f [math]::Max(6, $Variant.BorderWidth / 4) } else { "" }
      return "$outer`n$inner"
    }
    "oval" {
      $outer = '<ellipse cx="512" cy="512" rx="420" ry="306" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f $Variant.BorderWidth
      $inner = if ($Variant.BorderStyle -eq "double") { '<ellipse cx="512" cy="512" rx="374" ry="266" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f [math]::Max(6, $Variant.BorderWidth / 4) } else { "" }
      return "$outer`n$inner"
    }
    "tall_rect" {
      $outer = '<rect x="258" y="112" width="508" height="800" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f $Variant.BorderWidth
      $inner = if ($Variant.BorderStyle -eq "double") { '<rect x="296" y="152" width="432" height="720" stroke="#C91924" stroke-width="{0}" fill="none"/>' -f [math]::Max(6, $Variant.BorderWidth / 4) } else { "" }
      return "$outer`n$inner"
    }
    default { throw "Unknown SVG shape $($Variant.Shape)" }
  }
}

function Get-SvgGridMarkup {
  param([hashtable]$Variant)

  if (-not $Variant.ShowGrid) { return "" }

  switch ($Variant.Shape) {
    "round" { $x=302; $y=300; $w=420; $h=420 }
    "square" { $x=252; $y=252; $w=520; $h=520 }
    "rounded_square" { $x=264; $y=264; $w=496; $h=496 }
    "oval" { $x=270; $y=290; $w=484; $h=444 }
    "tall_rect" { $x=338; $y=208; $w=348; $h=612 }
    default { $x=300; $y=300; $w=424; $h=424 }
  }

  $grid = '<rect x="{0}" y="{1}" width="{2}" height="{3}" stroke="#C91924" stroke-width="{4}" fill="none"/>' -f $x, $y, $w, $h, $Variant.GridWidth
  if ($Variant.Layout -eq "grid4") {
    $grid += "`n" + ('<line x1="{0}" y1="{1}" x2="{0}" y2="{2}" stroke="#C91924" stroke-width="{3}"/>' -f ($x + ($w / 2)), $y, ($y + $h), $Variant.GridWidth)
    $grid += "`n" + ('<line x1="{0}" y1="{1}" x2="{2}" y2="{1}" stroke="#C91924" stroke-width="{3}"/>' -f $x, ($y + ($h / 2)), ($x + $w), $Variant.GridWidth)
  }
  return $grid
}

function Get-SvgTextMarkup {
  param([hashtable]$Variant)

  $fontFamily = $Variant.SvgFont
  $markup = @()

  if ($Variant.TopLabel) {
    $y = if ($Variant.Shape -eq "oval") { 272 } else { 176 }
    $markup += '<text x="512" y="{0}" text-anchor="middle" fill="#C91924" font-family="{1}" font-size="{2}" font-weight="700">{3}</text>' -f $y, $fontFamily, $Variant.SmallFontSize, $Variant.TopLabel
  }
  if ($Variant.BottomLabel) {
    $y = 846
    if ($Variant.Shape -eq "oval") { $y = 726 }
    if ($Variant.Shape -eq "tall_rect") { $y = 866 }
    $markup += '<text x="512" y="{0}" text-anchor="middle" fill="#C91924" font-family="{1}" font-size="{2}" font-weight="700">{3}</text>' -f $y, $fontFamily, $Variant.SmallFontSize, $Variant.BottomLabel
  }

  switch ($Variant.Layout) {
    "grid4" {
      $chars = $Variant.Text.ToCharArray()
      $positions = @(
        @{X=416; Y=430},
        @{X=608; Y=430},
        @{X=416; Y=638},
        @{X=608; Y=638}
      )
      if ($Variant.Shape -eq "square") {
        $positions = @(
          @{X=392; Y=420},
          @{X=632; Y=420},
          @{X=392; Y=660},
          @{X=632; Y=660}
        )
      }
      elseif ($Variant.Shape -eq "rounded_square") {
        $positions = @(
          @{X=398; Y=426},
          @{X=626; Y=426},
          @{X=398; Y=654},
          @{X=626; Y=654}
        )
      }
      elseif ($Variant.Shape -eq "oval") {
        $positions = @(
          @{X=410; Y=442},
          @{X=614; Y=442},
          @{X=410; Y=646},
          @{X=614; Y=646}
        )
      }

      for ($i = 0; $i -lt [Math]::Min(4, $chars.Length); $i++) {
        $markup += '<text x="{0}" y="{1}" text-anchor="middle" fill="#C91924" font-family="{2}" font-size="{3}" font-weight="700">{4}</text>' -f $positions[$i].X, $positions[$i].Y, $fontFamily, $Variant.FontSize, [string]$chars[$i]
      }
    }
    "vertical4" {
      $chars = $Variant.Text.ToCharArray()
      $ys = @(314, 462, 610, 758)
      for ($i = 0; $i -lt [Math]::Min(4, $chars.Length); $i++) {
        $markup += '<text x="512" y="{0}" text-anchor="middle" fill="#C91924" font-family="{1}" font-size="{2}" font-weight="700">{3}</text>' -f $ys[$i], $fontFamily, $Variant.FontSize, [string]$chars[$i]
      }
    }
    "horizontal" {
      $markup += '<text x="512" y="558" text-anchor="middle" fill="#C91924" font-family="{0}" font-size="{1}" font-weight="700">{2}</text>' -f $fontFamily, $Variant.FontSize, $Variant.Text
    }
  }

  return ($markup -join "`n")
}

function New-SealSvg {
  param(
    [hashtable]$Variant,
    [string]$OutPath
  )

  $shape = Get-SvgShapeMarkup -Variant $Variant
  $grid = Get-SvgGridMarkup -Variant $Variant
  $text = Get-SvgTextMarkup -Variant $Variant

  $content = @"
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" fill="none">
  <g transform="rotate($($Variant.Rotate) 512 512)">
    $shape
    $grid
    $text
  </g>
</svg>
"@

  [System.IO.File]::WriteAllText($OutPath, $content, [System.Text.Encoding]::UTF8)
}

function New-PreviewBoard {
  param(
    [hashtable[]]$Variants,
    [string]$OutPath,
    [string]$Title
  )

  $cols = 4
  $rows = [int][Math]::Ceiling($Variants.Count / $cols)
  $tileW = 330
  $tileH = 400
  $margin = 28
  $width = ($cols * $tileW) + (($cols + 1) * $margin)
  $height = ($rows * $tileH) + (($rows + 1) * $margin) + 100

  $bmp = New-Object System.Drawing.Bitmap $width, $height
  $graphics = [System.Drawing.Graphics]::FromImage($bmp)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.Color]::White)

  $titleFont = New-Font -Candidates @("Malgun Gothic", "Batang", "Gulim") -Size 38
  $labelFont = New-Font -Candidates @("Malgun Gothic", "Batang", "Gulim") -Size 20
  $titleBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(32, 36, 45))
  $subBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(86, 90, 100))
  $cardPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(222, 226, 233), 2)
  $format = New-StringFormatCenter

  try {
    $graphics.DrawString($Title, $titleFont, $titleBrush, [System.Drawing.RectangleF]::new(0, 24, $width, 60), $format)

    for ($i = 0; $i -lt $Variants.Count; $i++) {
      $variant = $Variants[$i]
      $col = $i % $cols
      $row = [int]($i / $cols)

      $cardX = $margin + ($col * ($tileW + $margin))
      $cardY = 100 + $margin + ($row * ($tileH + $margin))
      $cardRect = [System.Drawing.Rectangle]::new($cardX, $cardY, $tileW, $tileH)
      $graphics.DrawRectangle($cardPen, $cardRect)

      $pngPath = Join-Path ($variant.KindDir) "$($variant.FileStem).png"
      $img = [System.Drawing.Image]::FromFile($pngPath)
      try {
      $graphics.DrawImage($img, [System.Drawing.Rectangle]::new($cardX + 24, $cardY + 20, 280, 280))
      }
      finally {
        $img.Dispose()
      }

      $graphics.DrawString($variant.Id, $titleFont, $titleBrush, [System.Drawing.RectangleF]::new($cardX, $cardY + 308, $tileW, 34), $format)
      $graphics.DrawString($variant.Title, $labelFont, $subBrush, [System.Drawing.RectangleF]::new($cardX + 14, $cardY + 346, $tileW - 28, 34), $format)
    }

    $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  }
  finally {
    $format.Dispose()
    $cardPen.Dispose()
    $titleBrush.Dispose()
    $subBrush.Dispose()
    $titleFont.Dispose()
    $labelFont.Dispose()
    $graphics.Dispose()
    $bmp.Dispose()
  }
}

$txt = @{
  CompanyName = U @(0xB85C, 0xC9C0, 0xC0AC, 0xC778)
  CompanyPrefix = U @(0xC8FC, 0xC2DD, 0xD68C, 0xC0AC)
  CompanyFull = U @(0xC8FC, 0xC2DD, 0xD68C, 0xC0AC, 0x0020, 0xB85C, 0xC9C0, 0xC0AC, 0xC778)
  CorpSeal = U @(0xBC95, 0xC778, 0xC778)
  OfficialSeal = U @(0xC9C1, 0xC778)
  DocConfirm = U @(0xBB38, 0xC11C, 0xD655, 0xC778)
  PersonalSeal = U @(0xAC1C, 0xC778, 0xC778)
  PersonName = U @(0xD64D, 0xAE38, 0xB3D9)
  PersonSeal = U @(0xD64D, 0xAE38, 0xB3D9, 0xC778)
  CorporateBoard = U @(0xBC95, 0xC778, 0x0020, 0xB3C4, 0xC7A5, 0x0020, 0xC2DC, 0xC548, 0x0020, 0x0038, 0xC885)
  PersonalBoard = U @(0xAC1C, 0xC778, 0x0020, 0xB3C4, 0xC7A5, 0x0020, 0xC2DC, 0xC548, 0x0020, 0x0038, 0xC885)
}

$corporateVariants = @(
  @{
    Id = "C1"; Title = "Round double legal"; Shape = "round"; BorderStyle = "double"; BorderWidth = 34; GridWidth = 28; ShowGrid = $true
    FontCandidates = @("Gungsuh", "Batang", "Malgun Gothic"); SvgFont = "Gungsuh, Batang, Malgun Gothic, sans-serif"; FontSize = 122; SmallFontSize = 42
    TopLabel = $txt.CompanyPrefix; BottomLabel = $txt.CorpSeal; Layout = "grid4"; Text = $txt.CompanyName; Rotate = -4
  },
  @{
    Id = "C2"; Title = "Round clean official"; Shape = "round"; BorderStyle = "single"; BorderWidth = 36; GridWidth = 24; ShowGrid = $false
    FontCandidates = @("Malgun Gothic", "Gulim", "Batang"); SvgFont = "Malgun Gothic, Gulim, sans-serif"; FontSize = 128; SmallFontSize = 38
    TopLabel = $txt.CompanyFull; BottomLabel = $txt.OfficialSeal; Layout = "grid4"; Text = $txt.CompanyName; Rotate = -2
  },
  @{
    Id = "C3"; Title = "Square grid legal"; Shape = "square"; BorderStyle = "double"; BorderWidth = 32; GridWidth = 24; ShowGrid = $true
    FontCandidates = @("Batang", "Gungsuh", "Malgun Gothic"); SvgFont = "Batang, Gungsuh, serif"; FontSize = 124; SmallFontSize = 38
    TopLabel = ""; BottomLabel = $txt.CorpSeal; Layout = "grid4"; Text = $txt.CompanyName; Rotate = -1
  },
  @{
    Id = "C4"; Title = "Rounded square official"; Shape = "rounded_square"; BorderStyle = "single"; BorderWidth = 34; GridWidth = 22; ShowGrid = $true
    FontCandidates = @("Malgun Gothic", "Batang", "Gulim"); SvgFont = "Malgun Gothic, Batang, sans-serif"; FontSize = 122; SmallFontSize = 38
    TopLabel = ""; BottomLabel = $txt.OfficialSeal; Layout = "grid4"; Text = $txt.CompanyName; Rotate = -3
  },
  @{
    Id = "C5"; Title = "Oval full-name legal"; Shape = "oval"; BorderStyle = "double"; BorderWidth = 28; GridWidth = 20; ShowGrid = $false
    FontCandidates = @("Batang", "Malgun Gothic", "Gulim"); SvgFont = "Batang, Malgun Gothic, serif"; FontSize = 84; SmallFontSize = 38
    TopLabel = $txt.CompanyPrefix; BottomLabel = $txt.CorpSeal; Layout = "horizontal"; Text = $txt.CompanyName; Rotate = -2
  },
  @{
    Id = "C6"; Title = "Oval confirmation official"; Shape = "oval"; BorderStyle = "single"; BorderWidth = 28; GridWidth = 20; ShowGrid = $false
    FontCandidates = @("Gulim", "Malgun Gothic", "Batang"); SvgFont = "Gulim, Malgun Gothic, sans-serif"; FontSize = 82; SmallFontSize = 36
    TopLabel = $txt.CompanyFull; BottomLabel = $txt.OfficialSeal; Layout = "horizontal"; Text = $txt.DocConfirm; Rotate = -1
  },
  @{
    Id = "C7"; Title = "Tall traditional legal"; Shape = "tall_rect"; BorderStyle = "single"; BorderWidth = 30; GridWidth = 0; ShowGrid = $false
    FontCandidates = @("Gungsuh", "Batang", "Malgun Gothic"); SvgFont = "Gungsuh, Batang, serif"; FontSize = 118; SmallFontSize = 34
    TopLabel = ""; BottomLabel = $txt.CorpSeal; Layout = "vertical4"; Text = $txt.CompanyName; Rotate = -2
  },
  @{
    Id = "C8"; Title = "Tall double official"; Shape = "tall_rect"; BorderStyle = "double"; BorderWidth = 28; GridWidth = 0; ShowGrid = $false
    FontCandidates = @("Batang", "Gungsuh", "Malgun Gothic"); SvgFont = "Batang, Gungsuh, serif"; FontSize = 114; SmallFontSize = 34
    TopLabel = ""; BottomLabel = $txt.OfficialSeal; Layout = "vertical4"; Text = $txt.CompanyName; Rotate = -4
  }
)

$personalVariants = @(
  @{
    Id = "P1"; Title = "Round traditional"; Shape = "round"; BorderStyle = "double"; BorderWidth = 34; GridWidth = 28; ShowGrid = $true
    FontCandidates = @("Gungsuh", "Batang", "Malgun Gothic"); SvgFont = "Gungsuh, Batang, serif"; FontSize = 122; SmallFontSize = 40
    TopLabel = ""; BottomLabel = $txt.PersonalSeal; Layout = "grid4"; Text = $txt.PersonSeal; Rotate = -3
  },
  @{
    Id = "P2"; Title = "Round modern"; Shape = "round"; BorderStyle = "single"; BorderWidth = 36; GridWidth = 20; ShowGrid = $false
    FontCandidates = @("Malgun Gothic", "Gulim", "Batang"); SvgFont = "Malgun Gothic, Gulim, sans-serif"; FontSize = 126; SmallFontSize = 38
    TopLabel = ""; BottomLabel = $txt.PersonSeal; Layout = "grid4"; Text = $txt.PersonSeal; Rotate = -1
  },
  @{
    Id = "P3"; Title = "Square classic"; Shape = "square"; BorderStyle = "double"; BorderWidth = 32; GridWidth = 24; ShowGrid = $true
    FontCandidates = @("Batang", "Gungsuh", "Malgun Gothic"); SvgFont = "Batang, Gungsuh, serif"; FontSize = 124; SmallFontSize = 38
    TopLabel = ""; BottomLabel = ""; Layout = "grid4"; Text = $txt.PersonSeal; Rotate = -2
  },
  @{
    Id = "P4"; Title = "Rounded minimal"; Shape = "rounded_square"; BorderStyle = "single"; BorderWidth = 34; GridWidth = 20; ShowGrid = $true
    FontCandidates = @("Malgun Gothic", "Batang", "Gulim"); SvgFont = "Malgun Gothic, Batang, sans-serif"; FontSize = 122; SmallFontSize = 36
    TopLabel = ""; BottomLabel = ""; Layout = "grid4"; Text = $txt.PersonSeal; Rotate = -4
  },
  @{
    Id = "P5"; Title = "Oval practical"; Shape = "oval"; BorderStyle = "double"; BorderWidth = 28; GridWidth = 0; ShowGrid = $false
    FontCandidates = @("Batang", "Malgun Gothic", "Gulim"); SvgFont = "Batang, Malgun Gothic, serif"; FontSize = 86; SmallFontSize = 36
    TopLabel = ""; BottomLabel = $txt.PersonSeal; Layout = "horizontal"; Text = $txt.PersonName; Rotate = -1
  },
  @{
    Id = "P6"; Title = "Tall gungsuh"; Shape = "tall_rect"; BorderStyle = "single"; BorderWidth = 30; GridWidth = 0; ShowGrid = $false
    FontCandidates = @("Gungsuh", "Batang", "Malgun Gothic"); SvgFont = "Gungsuh, Batang, serif"; FontSize = 118; SmallFontSize = 34
    TopLabel = ""; BottomLabel = ""; Layout = "vertical4"; Text = $txt.PersonSeal; Rotate = -2
  },
  @{
    Id = "P7"; Title = "Tall double border"; Shape = "tall_rect"; BorderStyle = "double"; BorderWidth = 28; GridWidth = 0; ShowGrid = $false
    FontCandidates = @("Batang", "Gungsuh", "Malgun Gothic"); SvgFont = "Batang, Gungsuh, serif"; FontSize = 114; SmallFontSize = 34
    TopLabel = ""; BottomLabel = ""; Layout = "vertical4"; Text = $txt.PersonSeal; Rotate = -4
  },
  @{
    Id = "P8"; Title = "Square clean"; Shape = "square"; BorderStyle = "single"; BorderWidth = 32; GridWidth = 22; ShowGrid = $false
    FontCandidates = @("Gulim", "Malgun Gothic", "Batang"); SvgFont = "Gulim, Malgun Gothic, sans-serif"; FontSize = 120; SmallFontSize = 34
    TopLabel = ""; BottomLabel = $txt.PersonSeal; Layout = "grid4"; Text = $txt.PersonSeal; Rotate = -1
  }
)

foreach ($variant in $corporateVariants) {
  $variant.KindDir = $corporateDir
  $variant.FileStem = "corporate-$($variant.Id.ToLower())"
  New-SealSvg -Variant $variant -OutPath (Join-Path $corporateDir "$($variant.FileStem).svg")
  New-SealPng -Variant $variant -OutPath (Join-Path $corporateDir "$($variant.FileStem).png")
}

foreach ($variant in $personalVariants) {
  $variant.KindDir = $personalDir
  $variant.FileStem = "personal-$($variant.Id.ToLower())"
  New-SealSvg -Variant $variant -OutPath (Join-Path $personalDir "$($variant.FileStem).svg")
  New-SealPng -Variant $variant -OutPath (Join-Path $personalDir "$($variant.FileStem).png")
}

New-PreviewBoard -Variants $corporateVariants -OutPath (Join-Path $previewDir "corporate-selection-board.png") -Title $txt.CorporateBoard
New-PreviewBoard -Variants $personalVariants -OutPath (Join-Path $previewDir "personal-selection-board.png") -Title $txt.PersonalBoard

$manifest = [ordered]@{
  corporate = $corporateVariants | ForEach-Object {
    [ordered]@{
      id = $_.Id
      title = $_.Title
      png = (Join-Path $corporateDir "$($_.FileStem).png")
      svg = (Join-Path $corporateDir "$($_.FileStem).svg")
    }
  }
  personal = $personalVariants | ForEach-Object {
    [ordered]@{
      id = $_.Id
      title = $_.Title
      png = (Join-Path $personalDir "$($_.FileStem).png")
      svg = (Join-Path $personalDir "$($_.FileStem).svg")
    }
  }
  preview = [ordered]@{
    corporateBoard = (Join-Path $previewDir "corporate-selection-board.png")
    personalBoard = (Join-Path $previewDir "personal-selection-board.png")
  }
}

$manifest | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $baseDir "seal-set-manifest.json") -Encoding UTF8
