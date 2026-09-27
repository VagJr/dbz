Add-Type -AssemblyName System.Drawing
$root=Join-Path (Get-Location) 'public/assets/world-kit'
$m=Get-Content "$root/manifest.json" -Raw | ConvertFrom-Json
$sources=@{}; foreach($key in @('items','equipment','nature','furniture','extra')){$sources[$key]=[Drawing.Bitmap]::FromFile("$root/source/$key.png")}
foreach($name in @('items','equipment','nature','furniture')){
 New-Item -ItemType Directory -Force "$root/$name" | Out-Null
 $sheet=New-Object Drawing.Bitmap 1792,1792; $sg=[Drawing.Graphics]::FromImage($sheet);$sg.Clear([Drawing.Color]::Transparent)
 foreach($entry in $m.sheets.$name){$cell=New-Object Drawing.Bitmap 128,128;$g=[Drawing.Graphics]::FromImage($cell);$g.Clear([Drawing.Color]::Transparent);$g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic;$r=$entry.rect;$scale=[Math]::Min(96/$r.w,96/$r.h);$w=[int][Math]::Round($r.w*$scale);$h=[int][Math]::Round($r.h*$scale);$dst=New-Object Drawing.Rectangle ([int]((128-$w)/2)),([int]((128-$h)/2)),$w,$h;$src=New-Object Drawing.Rectangle $r.x,$r.y,$r.w,$r.h;$g.DrawImage($sources[$entry.source],$dst,$src,[Drawing.GraphicsUnit]::Pixel);$g.Dispose();$cell.Save(("$root/$name/{0:D3}.png" -f [int]$entry.index),[Drawing.Imaging.ImageFormat]::Png);$sg.DrawImageUnscaled($cell,([int]($entry.index%14)*128),([int][Math]::Floor($entry.index/14)*128));$cell.Dispose()}
 $sg.Dispose();$sheet.Save("$root/$name-14x14.png",[Drawing.Imaging.ImageFormat]::Png);$sheet.Dispose();Write-Output "$name 196 sprites, 1792x1792 atlas, 16px minimum padding"
}
foreach($s in $sources.Values){$s.Dispose()}
