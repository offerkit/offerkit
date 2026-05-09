import Link from "next/link";
import { T } from "gt-next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Link href="/customers" className="block">
        <Card className="h-full transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>
              <T>Customers</T>
            </CardTitle>
            <CardDescription>
              <T>People who can redeem vouchers and earn loyalty points.</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <T>Browse customers, segments, and redemption history.</T>
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/campaigns" className="block">
        <Card className="h-full transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>
              <T>Campaigns</T>
            </CardTitle>
            <CardDescription>
              <T>Discounts, gift cards, loyalty, and referrals.</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <T>Create a campaign to mint vouchers.</T>
            </p>
          </CardContent>
        </Card>
      </Link>
      <Link href="/insights" className="block">
        <Card className="h-full transition-colors hover:bg-muted/50">
          <CardHeader>
            <CardTitle>
              <T>Insights</T>
            </CardTitle>
            <CardDescription>
              <T>Redemption volume, top campaigns, validation failures.</T>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              <T>See what is happening across your workspace.</T>
            </p>
          </CardContent>
        </Card>
      </Link>
    </div>
  );
}
