# 3D Gaussian Splatting Property Capture Guide

This guide explains how to capture, process, and generate 3D Gaussian Splatting files (.splat) for your property listings on Akkuea. With 3D Gaussian Splatting, investors can virtually walk through your property and make more informed decisions.

## Overview

3D Gaussian Splatting is a rendering technique that creates photorealistic, navigable 3D scenes from ordinary photos or video. Unlike traditional 3D modeling, it:

- Requires no specialized equipment (smartphone or consumer camera)
- Generates high-quality results with modest computing resources
- Produces highly compressed files suitable for web streaming
- Renders in real-time in any modern browser

## Prerequisites

### Equipment Options

You have several options for capturing images:

1. **Professional 3D Capture Service** (Recommended for Commercial Properties)
   - Companies like Matterport, Cupix, or local 3D scanning services
   - Cost: $500–$5,000+ depending on property size and location
   - Time: 1–2 hours on-site

2. **Consumer Grade (iPhone/Android + Processing Service)**
   - iPhone 12+ with LiDAR, or high-end Android phone
   - Capture images following the guidelines below
   - Use RealityScan (free) or Polycam app ($10–$40)
   - Processing time: 5–30 minutes

3. **Action Camera + Video Capture**
   - GoPro, DJI Osmo, or similar
   - Capture video walk-throughs
   - Process with commercial software

## Capture Phase

### For Mobile Phone Captures

1. **Pre-Capture Checklist**
   - Ensure good natural lighting (overcast days are ideal)
   - Remove clutter and personal items from visible surfaces
   - Open windows and doors to show room connections
   - Ensure WiFi/LTE connection for uploads if using cloud services

2. **Capture Techniques**
   - Start from one corner and slowly walk through the property
   - Overlap images: each photo should contain 30–50% of the previous photo
   - Capture both wide shots and detailed views of key features
   - Include exterior, entrance, each room, and outdoor spaces
   - Total images: 50–300 depending on property size

3. **Recommended Capture Tools**
   - **Polycam** (iOS/Android): User-friendly, supports AI meshing
   - **RealityScan** (iOS, free): Excellent depth capture with newer iPhones
   - **Meshroom** (Desktop): Open-source, no subscription needed
   - **Capture3D** (iOS): Optimized for real estate

### For Professional Captures

If using a 3D scanning service, request output in PLY or LAC format for Gaussian Splatting conversion.

## Processing Phase

After capturing images, you need to process them into a .splat file.

### Option 1: Commercial Processing (Easiest)

Services like Polycam, RealityScan, and others offer built-in Gaussian Splatting export.

**Polycam Workflow:**

1. Open captured project in Polycam
2. Wait for processing (5–15 minutes)
3. In the "Export" menu, select "Download GLB (Gaussian Splatting)"
4. Save the file

**RealityScan Workflow:**

1. Scan property with app
2. Once processing completes, tap "Export"
3. Choose "Gaussian Splatting" format
4. Download the .splat file

### Option 2: Open-Source Processing

Use **Meshroom** (free, cross-platform) or **Luma AI** web interface:

**Meshroom Steps:**

1. Download Meshroom from [https://alicevision.org/](https://alicevision.org/)
2. Create a new project
3. Add your captured images (drag-and-drop folder)
4. Run the full reconstruction pipeline
5. Export as PLY
6. Convert PLY to .splat using a converter (see below)

**Luma AI (Web-based):**

1. Visit [https://lumalabs.ai/](https://lumalabs.ai/)
2. Upload images or video
3. Wait for processing (varies by plan)
4. Download .splat file directly

### Format Conversion

If processing outputs PLY or LAC format instead of .splat:

**Using Python (Local Conversion):**

```bash
pip install plyfile numpy

python3 -c "
import numpy as np
from plyfile import PlyData

ply = PlyData.read('input.ply')
vertices = ply['vertex']

# Extract Gaussian Splatting data
positions = np.column_stack((vertices['x'], vertices['y'], vertices['z']))
colors = np.column_stack((vertices['red'], vertices['green'], vertices['blue']))

# Save as .splat
splat_data = np.concatenate([positions, colors], axis=1).astype(np.float32)
splat_data.tofile('output.splat')
"
```

**Web-based Conversion:**
Several sites offer drag-and-drop conversion:

- [https://www.mattkanwisher.com/gs-splat-viewer/](https://www.mattkanwisher.com/gs-splat-viewer/)
- [https://playcanvas.com/](https://playcanvas.com/) (requires account)

## File Optimization

Before uploading, optimize your .splat file for web streaming.

### Compression Tips

1. **Reduce Point Cloud Density**
   - Most Gaussian Splatting viewers can handle 1–10M points
   - Exceeding this causes browser slowdown
   - Use point cloud decimation tools if needed

2. **Check File Size**
   - Target: 50MB–500MB depending on property size and detail
   - Too large: Streaming will be slow
   - Too small: May lose visual quality

3. **Validation**
   - Use https://huggingface.co/spaces/playcanvas/gsplat to preview
   - Verify the file loads completely in under 2 minutes
   - Test on mobile and mid-range laptops

## Uploading to Akkuea

Once you have a validated .splat file:

1. **Upload Storage**
   - Akkuea supports IPFS, AWS S3, or CloudFlare R2 URLs
   - Ensure the hosting service supports range requests (for streaming)
   - Examples:
     - IPFS (Pinata, Nft.storage): `https://ipfs.io/ipfs/Qm...`
     - AWS S3: `https://mybucket.s3.amazonaws.com/property.splat`

2. **Property Listing**
   - When creating or updating a property listing, include the .splat URL
   - The URL will be stored in the `splatUrl` field
   - The viewer will automatically appear on the property detail page

3. **Troubleshooting URL Issues**
   - Ensure CORS headers allow cross-origin requests from akkuea.example.com
   - Test URL in browser: it should download the .splat file
   - Verify the file is not behind authentication or rate-limiting

## Best Practices

### Capture Quality

- **Lighting**: Natural daylight or professional lighting (avoid harsh shadows)
- **Coverage**: Ensure 360° coverage of each room
- **Resolution**: Minimum 1920×1440 per image, higher is better
- **Overlap**: At least 30% overlap between consecutive images
- **Motion**: Move slowly and smoothly between shots

### Performance

- **Browser Compatibility**: Works on Chrome, Firefox, Safari, Edge (2020+)
- **GPU Requirements**: Mid-range GPU (Apple Silicon, Nvidia GTX 1050+, AMD RX 5700)
- **Mobile Support**: iPad Air 2022+, Samsung Galaxy Tab S7+, high-end Android tablets
- **Fallback**: If GPU unavailable, displays static property image instead

### Security & Privacy

- **Verify Property Ownership**: Only upload 3D models of properties you have rights to
- **Blurring Sensitive Content**: Consider blurring faces, license plates, or personal documents
- **Data Storage**: Akkuea doesn't store .splat files; only URLs are stored
- **Third-Party Hosting**: Ensure your file host (S3, IPFS, etc.) has appropriate privacy settings

## Troubleshooting

### "File failed to load"

- Verify the URL is accessible in your browser
- Check CORS headers on your hosting service
- Ensure the file exists and hasn't been moved/deleted

### "Viewer is very slow / freezing"

- File may be too large (reduce point density)
- GPU may be insufficient (upgrade browser or device)
- Try fullscreen mode to reduce UI overhead
- Clear browser cache and reload

### "Viewer shows blank screen"

- WebGL not supported in your browser (use Chrome/Firefox/Safari)
- Hardware acceleration may be disabled in browser settings
- Try a different browser or device

### "File uploads but doesn't appear in preview"

- Check that the `splatUrl` field was saved correctly
- Verify the URL in the property details page
- Wait 5 minutes; cached content may be refreshing
- Contact Akkuea support if issue persists

## Advanced Topics

### Streaming Optimization

Akkuea's viewer implements HTTP range requests to stream .splat files progressively. To ensure optimal performance:

1. **Server Configuration** (Your Hosting Provider)
   - Enable HTTP/1.1 range requests (Accept-Ranges: bytes)
   - Set appropriate Cache-Control headers: `public, max-age=31536000, immutable`
   - Enable gzip compression for your storage bucket

2. **File Format**
   - Use .splat (binary PLY format) for best compression
   - Avoid .ply files; they're typically 3–5× larger

### Real-Time Updates

If you want to update the 3D model after listing:

1. Upload a new .splat file to your storage
2. Update the `splatUrl` in your property listing
3. Clear browser cache (Ctrl+Shift+Del or Cmd+Shift+Del)
4. The new model will be visible within minutes

### Multi-Floor / Multi-Unit Properties

For larger properties with multiple floors or units:

1. **Option A (Recommended)**: Create separate .splat files for each floor/unit
2. **Option B**: Capture the entire property in one file and let investors navigate through
3. Contact Akkuea support for advanced multi-splat orchestration features

## Support & Resources

- **IPFS Pinning Services**: Pinata (pinata.cloud), nft.storage
- **3D Capture Apps**: Polycam, RealityScan, Meshroom
- **Processing Services**: Matterport, Cupix, Luma AI, NeRF Factory
- **Gaussian Splatting Resources**: https://github.com/graphdeco-inria/gaussian-splatting
- **Akkuea Support**: support@akkuea.example.com

---

**Last Updated**: May 2026  
**Akkuea 3D Viewer Version**: 1.0
