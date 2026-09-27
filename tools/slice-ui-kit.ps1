# Preserve complete atlas cells at native resolution, with a transparent safety margin.
# These generated sheets contain seven rows above an extra export margin, not a square 7x7 grid.
Add-Type -AssemblyName System.Drawing
$assetRoot = Join-Path $PSScriptRoot '..\public\assets\ui\generated'
$records = @()
foreach ($group in @('combat','hud','menu')) {
  $source = [Drawing.Bitmap]::FromFile((Join-Path $assetRoot "$group-atlas-7x7.png"))
  $folder = Join-Path $assetRoot $group
  New-Item -ItemType Directory -Force $folder | Out-Null
  $bounds = @(0)
  for ($r=1; $r -lt 7; $r++) {
    $expected = [int]($r * 174.5)
    $best = $expected; $score = [double]::PositiveInfinity
    for($y=$expected-9; $y -le $expected+9; $y++) {
      $sum=0
      for($x=0; $x -lt $source.Width; $x+=3) { $sum += $source.GetPixel($x,$y).A }
      if($sum -lt $score) {$best=$y; $score=$sum}
    }
    $bounds += $best
  }
  $bounds += $(if($group -eq 'menu'){$source.Height}else{[Math]::Min(1224,$source.Height)})
  $canvasSize = if($group -eq 'menu'){224}else{208}
  for ($row=0; $row -lt 7; $row++) {
    for ($col=0; $col -lt 7; $col++) {
      $x=[int][Math]::Round($col*$source.Width/7)
      $w=[int][Math]::Round(($col+1)*$source.Width/7)-$x
      $y=$bounds[$row]; $h=$bounds[$row+1]-$y
      $canvas=[Drawing.Bitmap]::new($canvasSize,$canvasSize,[Drawing.Imaging.PixelFormat]::Format32bppArgb)
      $g=[Drawing.Graphics]::FromImage($canvas)
      $g.CompositingMode=[Drawing.Drawing2D.CompositingMode]::SourceCopy
      $dx=[int][Math]::Floor(($canvasSize-$w)/2); $dy=[int][Math]::Floor(($canvasSize-$h)/2)
      $g.DrawImage($source,[Drawing.Rectangle]::new($dx,$dy,$w,$h),$x,$y,$w,$h,[Drawing.GraphicsUnit]::Pixel)
      $index=$row*7+$col+1
      $canvas.Save((Join-Path $folder ('{0:D2}.png' -f $index)),[Drawing.Imaging.ImageFormat]::Png)
      $records += @{group=$group;index=$index;source=@($x,$y,$w,$h);padding=@($dx,$dy);size=$canvasSize}
      $g.Dispose();$canvas.Dispose()
    }
  }
  Write-Output "$group : 49 complete cells; row boundaries $bounds"
  $source.Dispose()
}
$records | ConvertTo-Json -Depth 4 | Set-Content (Join-Path $assetRoot 'slice-map.json') -Encoding utf8

