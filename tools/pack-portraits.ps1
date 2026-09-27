Add-Type -AssemblyName System.Drawing
$groups=@(@{File='origins';Names=@('goku','piccolo','krillin','buu')},@{File='cast';Names=@('vegeta','bulma','roshi','frieza')},@{File='continuation';Names=@('cell','dabura','trunks','dende')})
foreach($group in $groups){$src=[System.Drawing.Bitmap]::new((Join-Path (Get-Location) ('public/assets/portraits/'+$group.File+'.png')));$size=[int]($src.Width/2);for($i=0;$i -lt 4;$i++){$rect=[System.Drawing.Rectangle]::new(($i%2)*$size,[math]::Floor($i/2)*$size,$size,$size);$tile=$src.Clone($rect,$src.PixelFormat);$tile.Save((Join-Path (Get-Location) ('public/assets/portraits/'+$group.Names[$i]+'.png')),[System.Drawing.Imaging.ImageFormat]::Png);$tile.Dispose()};$src.Dispose()}

