param([string]$Source)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System;using System.Collections.Generic;using System.Drawing;using System.Drawing.Imaging;using System.Runtime.InteropServices;
public class AtlasComponents {
 public static string Analyze(string file){using(var b=new Bitmap(file)){int w=b.Width,h=b.Height;var rect=new Rectangle(0,0,w,h);var data=b.LockBits(rect,ImageLockMode.ReadOnly,PixelFormat.Format32bppArgb);byte[] p=new byte[data.Stride*h];Marshal.Copy(data.Scan0,p,0,p.Length);b.UnlockBits(data);bool[] seen=new bool[w*h];int[] queue=new int[w*h];var result=new List<string>();for(int y=0;y<h;y++)for(int x=0;x<w;x++){int pos=y*w+x;if(seen[pos]||p[y*data.Stride+x*4+3]<96)continue;int head=0,tail=0,loX=x,hiX=x,loY=y,hiY=y;queue[tail++]=pos;seen[pos]=true;while(head<tail){int q=queue[head++],qx=q%w,qy=q/w;loX=Math.Min(loX,qx);hiX=Math.Max(hiX,qx);loY=Math.Min(loY,qy);hiY=Math.Max(hiY,qy);int[] neighbors={q-1,q+1,q-w,q+w};foreach(int n in neighbors){if(n<0||n>=w*h||seen[n]||Math.Abs(n%w-qx)>1||p[(n/w)*data.Stride+(n%w)*4+3]<96)continue;seen[n]=true;queue[tail++]=n;}}if(tail>100)result.Add("{\"x\":"+loX+",\"y\":"+loY+",\"w\":"+(hiX-loX+1)+",\"h\":"+(hiY-loY+1)+",\"area\":"+tail+"}");}return "["+string.Join(",",result)+"]";}}
}
"@
[AtlasComponents]::Analyze($Source)
