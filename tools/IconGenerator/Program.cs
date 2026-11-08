using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.IO;

namespace IconGenerator;

class Program
{
    static void Main(string[] args)
    {
        Console.WriteLine("Generating VISTARA Brand Icons...");

        int[] sizes = new[] { 16, 24, 32, 48, 64, 128, 256 };
        var pngFrames = new List<(int size, byte[] pngBytes)>();

        foreach (var size in sizes)
        {
            using var bmp = RenderVistaraLogo(size);
            using var ms = new MemoryStream();
            bmp.Save(ms, ImageFormat.Png);
            pngFrames.Add((size, ms.ToArray()));
        }

        // Also render 512 for high-res assets
        using (var bmp512 = RenderVistaraLogo(512))
        {
            Directory.CreateDirectory("assets");
            bmp512.Save("assets/logo-512.png", ImageFormat.Png);
            Console.WriteLine("Saved assets/logo-512.png");
        }

        // Write multi-resolution ICO file
        byte[] icoBytes = BuildIco(pngFrames);

        // Copy to desktop project
        File.WriteAllBytes("src/desktop/Vistara.Desktop/app.ico", icoBytes);
        Console.WriteLine("Saved src/desktop/Vistara.Desktop/app.ico");

        // Copy to backend project
        File.WriteAllBytes("src/backend/Vistara.Api/app.ico", icoBytes);
        Console.WriteLine("Saved src/backend/Vistara.Api/app.ico");

        // Copy to dist desktop & server
        Directory.CreateDirectory("dist/Vistara-v1.0.0-win-x64/desktop");
        Directory.CreateDirectory("dist/Vistara-v1.0.0-win-x64/server");
        File.WriteAllBytes("dist/Vistara-v1.0.0-win-x64/desktop/app.ico", icoBytes);
        File.WriteAllBytes("dist/Vistara-v1.0.0-win-x64/server/app.ico", icoBytes);

        // Copy to frontend public / assets
        Directory.CreateDirectory("src/frontend/public");
        File.WriteAllBytes("src/frontend/public/favicon.ico", icoBytes);
        File.WriteAllBytes("src/backend/Vistara.Api/wwwroot/favicon.ico", icoBytes);
        File.WriteAllBytes("dist/Vistara-v1.0.0-win-x64/server/wwwroot/favicon.ico", icoBytes);
        Console.WriteLine("Saved favicon.ico across frontend & wwwroot");

        // Write SVG favicon
        string svg = GenerateSvg();
        File.WriteAllText("src/frontend/public/favicon.svg", svg);
        File.WriteAllText("src/backend/Vistara.Api/wwwroot/favicon.svg", svg);
        File.WriteAllText("dist/Vistara-v1.0.0-win-x64/server/wwwroot/favicon.svg", svg);
        Console.WriteLine("Saved favicon.svg");

        Console.WriteLine("All icons generated successfully!");
    }

    static Bitmap RenderVistaraLogo(int size)
    {
        var bmp = new Bitmap(size, size, PixelFormat.Format32bppArgb);
        using var g = Graphics.FromImage(bmp);

        g.SmoothingMode = SmoothingMode.HighQuality;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.Clear(Color.Transparent);

        float s = size / 100f;

        // 1. Sleek rounded squircle background
        float pad = 3f * s;
        float cornerRadius = 22f * s;
        RectangleF bgRect = new RectangleF(pad, pad, size - pad * 2, size - pad * 2);

        using (var bgPath = CreateRoundedRectangle(bgRect, cornerRadius))
        {
            // Radial or Linear gradient for subtle dark plate
            using (var bgBrush = new LinearGradientBrush(
                new PointF(0, 0),
                new PointF(size, size),
                Color.FromArgb(255, 20, 24, 34),   // #141822
                Color.FromArgb(255, 8, 10, 15)))   // #080a0f
            {
                g.FillPath(bgBrush, bgPath);
            }

            // Plate subtle border
            using (var borderPen = new Pen(Color.FromArgb(200, 42, 51, 68), 1.2f * s)) // #2a3344
            {
                g.DrawPath(borderPen, bgPath);
            }
        }

        // 2. Glow halo behind emblem
        using (var glowBrush = new PathGradientBrush(new PointF[] {
            new PointF(50 * s, 20 * s),
            new PointF(85 * s, 50 * s),
            new PointF(50 * s, 85 * s),
            new PointF(15 * s, 50 * s)
        }))
        {
            glowBrush.CenterColor = Color.FromArgb(70, 168, 85, 247); // Electric purple glow
            glowBrush.SurroundColors = new Color[] { Color.Transparent, Color.Transparent, Color.Transparent, Color.Transparent };
            g.FillEllipse(glowBrush, 20 * s, 20 * s, 60 * s, 60 * s);
        }

        // 3. Emblem coordinates (100x100 reference space)
        // Left facet: [ (18, 20), (50, 84), (50, 56), (34, 20) ]
        PointF[] leftFacet = new PointF[]
        {
            new PointF(18f * s, 20f * s),
            new PointF(50f * s, 84f * s),
            new PointF(50f * s, 56f * s),
            new PointF(34f * s, 20f * s)
        };

        using (var leftBrush = new LinearGradientBrush(
            new PointF(18f * s, 20f * s),
            new PointF(50f * s, 84f * s),
            Color.FromArgb(255, 168, 85, 247),  // #a855f7
            Color.FromArgb(255, 109, 40, 217))) // #6d28d9
        {
            g.FillPolygon(leftBrush, leftFacet);
        }

        // Right facet: [ (50, 84), (82, 20), (66, 20), (50, 56) ]
        PointF[] rightFacet = new PointF[]
        {
            new PointF(50f * s, 84f * s),
            new PointF(82f * s, 20f * s),
            new PointF(66f * s, 20f * s),
            new PointF(50f * s, 56f * s)
        };

        using (var rightBrush = new LinearGradientBrush(
            new PointF(82f * s, 20f * s),
            new PointF(50f * s, 84f * s),
            Color.FromArgb(255, 255, 255, 255), // Pure white chrome highlight
            Color.FromArgb(255, 124, 58, 237))) // Deep violet #7c3aed
        {
            ColorBlend cb = new ColorBlend(4);
            cb.Colors = new Color[]
            {
                Color.FromArgb(255, 255, 255, 255), // #ffffff
                Color.FromArgb(255, 192, 132, 252), // #c084fc
                Color.FromArgb(255, 124, 58, 237),  // #7c3aed
                Color.FromArgb(255, 76, 29, 149)    // #4c1d95
            };
            cb.Positions = new float[] { 0.0f, 0.25f, 0.70f, 1.0f };
            rightBrush.InterpolationColors = cb;

            g.FillPolygon(rightBrush, rightFacet);
        }

        // Center prism top wedge: [ (42, 20), (50, 38), (58, 20) ]
        PointF[] centerWedge = new PointF[]
        {
            new PointF(42f * s, 20f * s),
            new PointF(50f * s, 38f * s),
            new PointF(58f * s, 20f * s)
        };

        using (var wedgeBrush = new SolidBrush(Color.FromArgb(255, 255, 255, 255)))
        {
            g.FillPolygon(wedgeBrush, centerWedge);
        }

        // Outer contour line for crisp precision at all resolutions
        PointF[] outerContour = new PointF[]
        {
            new PointF(18f * s, 20f * s),
            new PointF(50f * s, 84f * s),
            new PointF(82f * s, 20f * s),
            new PointF(66f * s, 20f * s),
            new PointF(50f * s, 56f * s),
            new PointF(34f * s, 20f * s)
        };

        using (var contourPen = new Pen(Color.FromArgb(180, 192, 132, 252), Math.Max(1f, 1.2f * s)))
        {
            contourPen.LineJoin = LineJoin.Round;
            g.DrawPolygon(contourPen, outerContour);
        }

        return bmp;
    }

    static GraphicsPath CreateRoundedRectangle(RectangleF rect, float radius)
    {
        GraphicsPath path = new GraphicsPath();
        float diameter = radius * 2f;
        RectangleF arc = new RectangleF(rect.X, rect.Y, diameter, diameter);

        // Top-left arc
        path.AddArc(arc, 180, 90);

        // Top-right arc
        arc.X = rect.Right - diameter;
        path.AddArc(arc, 270, 90);

        // Bottom-right arc
        arc.Y = rect.Bottom - diameter;
        path.AddArc(arc, 0, 90);

        // Bottom-left arc
        arc.X = rect.Left;
        path.AddArc(arc, 90, 90);

        path.CloseFigure();
        return path;
    }

    static byte[] BuildIco(List<(int size, byte[] pngBytes)> frames)
    {
        using var ms = new MemoryStream();
        using var bw = new BinaryWriter(ms);

        // 1. ICONDIR Header (6 bytes)
        bw.Write((short)0); // Reserved
        bw.Write((short)1); // Type 1 = ICO
        bw.Write((short)frames.Count); // Count of images

        // 2. ICONDIRENTRY list (16 bytes each)
        int currentOffset = 6 + (16 * frames.Count);

        foreach (var frame in frames)
        {
            byte w = frame.size >= 256 ? (byte)0 : (byte)frame.size;
            byte h = frame.size >= 256 ? (byte)0 : (byte)frame.size;

            bw.Write(w);                      // Width
            bw.Write(h);                      // Height
            bw.Write((byte)0);                // Color count
            bw.Write((byte)0);                // Reserved
            bw.Write((short)1);               // Color planes
            bw.Write((short)32);              // Bits per pixel
            bw.Write(frame.pngBytes.Length);  // Bytes in resource
            bw.Write(currentOffset);           // Image offset

            currentOffset += frame.pngBytes.Length;
        }

        // 3. Image data blocks (PNG format)
        foreach (var frame in frames)
        {
            bw.Write(frame.pngBytes);
        }

        return ms.ToArray();
    }

    static string GenerateSvg()
    {
        return @"<svg xmlns=""http://www.w3.org/2000/svg"" viewBox=""0 0 100 100"">
  <defs>
    <linearGradient id=""bgGrad"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">
      <stop offset=""0%"" stop-color=""#141822"" />
      <stop offset=""100%"" stop-color=""#080a0f"" />
    </linearGradient>
    <linearGradient id=""vGradMain"" x1=""100%"" y1=""0%"" x2=""0%"" y2=""100%"">
      <stop offset=""0%"" stop-color=""#ffffff"" />
      <stop offset=""25%"" stop-color=""#c084fc"" />
      <stop offset=""70%"" stop-color=""#7c3aed"" />
      <stop offset=""100%"" stop-color=""#4c1d95"" />
    </linearGradient>
    <linearGradient id=""vGradLeft"" x1=""0%"" y1=""0%"" x2=""100%"" y2=""100%"">
      <stop offset=""0%"" stop-color=""#a855f7"" />
      <stop offset=""100%"" stop-color=""#6d28d9"" />
    </linearGradient>
  </defs>
  <rect x=""3"" y=""3"" width=""94"" height=""94"" rx=""22"" fill=""url(#bgGrad)"" stroke=""#2a3344"" stroke-width=""1.5"" />
  <path d=""M 18 20 L 50 84 L 50 56 L 34 20 Z"" fill=""url(#vGradLeft)"" />
  <path d=""M 50 84 L 82 20 L 66 20 L 50 56 Z"" fill=""url(#vGradMain)"" />
  <path d=""M 42 20 L 50 38 L 58 20 Z"" fill=""#ffffff"" />
  <path d=""M 18 20 L 50 84 L 82 20 L 66 20 L 50 56 L 34 20 Z"" fill=""none"" stroke=""#c084fc"" stroke-width=""1.2"" stroke-linejoin=""round"" />
</svg>";
    }
}

