import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

async function checkUrlExists(url: string) {
  try {
    const res = await fetch(url, { method: 'HEAD' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const itemCode = url.searchParams.get('itemCode');
  const modelCode = url.searchParams.get('modelCode');

  if (!itemCode) {
    return new NextResponse('Missing itemCode', { status: 400 });
  }

  try {
    const last3 = itemCode.slice(-3);
    const modelOriginal = modelCode || '';
    
    // External site mapping (Joomla SIG Pro)
    const baseUrl = `https://yanayltd.com/images/k2gl/${last3}`;
    const variantsToTry = [];
    
    if (modelCode) {
      // Original Case Only (Enforced by client request)
      variantsToTry.push(`${baseUrl}/${last3}-${modelOriginal}-01.jpg`);
      variantsToTry.push(`${baseUrl}/${last3}-${modelOriginal}-01.JPG`);
      // No -01 suffix
      variantsToTry.push(`${baseUrl}/${last3}-${modelOriginal}.jpg`);
      variantsToTry.push(`${baseUrl}/${last3}-${modelOriginal}.JPG`);
    }
    variantsToTry.push(`${baseUrl}/${last3}.jpg`);

    // Try finding the external image
    for (const imgUrl of variantsToTry) {
      const exists = await checkUrlExists(imgUrl);
      if (exists) {
        // Redirect the browser to the external URL
        const response = NextResponse.redirect(imgUrl, 302);
        // Cache the redirect so we don't bombard the external server on every page load
        response.headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
        return response;
      }
    }

    // Fallback: Check local gallery database just in case they uploaded something here
    let localImage = null;
    if (modelOriginal) {
      localImage = await prisma.galleryImage.findFirst({
        where: { filename: { startsWith: `${last3}-${modelOriginal}-01`, mode: 'insensitive' } }
      });
      if (!localImage) {
        localImage = await prisma.galleryImage.findFirst({
          where: { filename: { startsWith: `${last3}-${modelOriginal}`, mode: 'insensitive' } }
        });
      }
    }
    if (!localImage) {
      localImage = await prisma.galleryImage.findFirst({
        where: { filename: { startsWith: `${last3}`, mode: 'insensitive' } }
      });
    }

    if (localImage) {
      const parts = localImage.data.split(',');
      const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const buffer = Buffer.from(parts[1], 'base64');
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    // Fallback to BaseItem imageUrl if exists
    const baseItem = await prisma.baseItem.findUnique({
      where: { itemCode }
    });

    if (baseItem && baseItem.imageUrl) {
      const parts = baseItem.imageUrl.split(',');
      const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const base64Data = parts[1];
      const buffer = Buffer.from(base64Data, 'base64');
      
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Cache-Control': 'public, max-age=3600',
        }
      });
    }

    // No image found
    return new NextResponse('Not found', { status: 404 });
  } catch (error) {
    console.error('Error resolving image:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
