import { NextRequest, NextResponse } from "next/server";
import { getPrototypeData } from "@/lib/prototype-data";

// POST /prototype/[prototype]/get_latest_data
export async function POST(
  req: NextRequest,
  { params }: { params: { prototype: string } },
): Promise<NextResponse> {
  try {
    const { prototype: prototypeId } = params;
    const body = await req.json().catch(() => ({}));
    const { start_date, end_date } = body;

    // end_date requires start_date
    if (end_date != null && start_date == null) {
      return NextResponse.json(
        { error: "start_date is required when end_date is provided." },
        { status: 400 },
      );
    }

    let startDate: Date | undefined;
    let endDate: Date | undefined;

    if (start_date != null) {
      startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid start_date format. Expected ISO 8601 string." },
          { status: 400 },
        );
      }
    }

    if (end_date != null) {
      endDate = new Date(end_date);
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid end_date format. Expected ISO 8601 string." },
          { status: 400 },
        );
      }
    }

    // Default window: last 6 hours
    if (startDate == null) {
      endDate = new Date();
      startDate = new Date(endDate.getTime() - 6 * 60 * 60 * 1000);
    }

    // start_date present but end_date omitted → use now as upper bound
    if (endDate == null) {
      endDate = new Date();
    }

    const prototypeData = await getPrototypeData(prototypeId, startDate, endDate);

    return NextResponse.json(prototypeData, { status: 200 });
  } catch (error) {
    console.error("[get_latest_data]", error);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}