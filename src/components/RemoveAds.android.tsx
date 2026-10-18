import React from "react";
import { usePurchases } from "../hooks/usePurchases";
import { purchases } from "../services/purchases";
import { Body, Button, Card, Label } from "../ui";

export function RemoveAds() {
  const { owned, busy, loaded, price, message } = usePurchases();
  return (
    <Card>
      <Label>REMOVE ADS</Label>
      <Body>
        {owned
          ? "Ads are removed on this device."
          : "Enjoy Field Compass without banner ads. One-time purchase, no subscription."}
      </Body>
      {!owned && (
        <Button
          title={
            busy
              ? "Connecting to Google Play…"
              : price
                ? `Remove ads · ${price}`
                : "Remove ads · $2.99"
          }
          disabled={!loaded || busy}
          onPress={() => {
            void purchases.buy();
          }}
        />
      )}
      <Button
        title="Restore purchases"
        disabled={!loaded || busy}
        onPress={() => {
          void purchases.restore();
        }}
      />
      {message !== "" && <Body>{message}</Body>}
    </Card>
  );
}
