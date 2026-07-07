import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  const userId = (session as any)?.userId;
  if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 401 });

  const { inventoryItemId, packages, units } = await req.json();

  if (typeof packages !== 'number' || typeof units !== 'number' || packages < 0) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  }

  try {
    // 1. Fetch the total inventory and active reservations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const inventoryItem = await tx.inventoryItem.findUnique({
        where: { id: inventoryItemId }
      });

      if (!inventoryItem) {
        throw new Error('Item not found');
      }

      // Delete expired reservations for this item to ensure accurate calculation
      await tx.cartReservation.deleteMany({
        where: {
          inventoryItemId,
          expiresAt: { lt: new Date() }
        }
      });

      const otherReservations = await tx.cartReservation.findMany({
        where: {
          inventoryItemId,
          userId: { not: userId }
        }
      });

      const reservedUnitsByOthers = otherReservations.reduce((sum, res) => sum + res.units, 0);
      const availableUnitsForMe = inventoryItem.quantity - reservedUnitsByOthers;

      if (units > availableUnitsForMe) {
        throw new Error(`אין מספיק מלאי פנוי. נותרו ${Math.floor(availableUnitsForMe / (units / packages || 1))} אריזות`);
      }

      // Update or delete reservation
      if (packages === 0) {
        await tx.cartReservation.deleteMany({
          where: { userId, inventoryItemId }
        });
        return null;
      } else {
        // Expiration is set to 1 hour from now
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 1);

        const reservation = await tx.cartReservation.upsert({
          where: {
            userId_inventoryItemId: {
              userId,
              inventoryItemId
            }
          },
          update: {
            packages,
            units,
            expiresAt
          },
          create: {
            userId,
            inventoryItemId,
            packages,
            units,
            expiresAt
          }
        });
        return reservation;
      }
    });

    return NextResponse.json({ ok: true, reservation: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
