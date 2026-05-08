import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card>
        <CardHeader>
          <CardTitle>Customers</CardTitle>
          <CardDescription>People who can redeem vouchers and earn loyalty points.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Phase 2 ships customer CRUD and segments.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Segments</CardTitle>
          <CardDescription>JSON Logic rules over customer attributes.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Build a segment to target promotions.</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Promotions</CardTitle>
          <CardDescription>Campaigns, vouchers, gift cards, loyalty.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Coming in Phase 3.</p>
        </CardContent>
      </Card>
    </div>
  );
}
