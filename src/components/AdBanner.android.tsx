import React, { memo, useEffect, useState, useSyncExternalStore } from "react";
import { StyleSheet, View } from "react-native";
import {
  BannerAd,
  BannerAdSize,
  TestIds,
} from "react-native-google-mobile-ads";
import { ads } from "../services/ads.android";
import { Body, Button, Label } from "../ui";
import { usePurchases } from "../hooks/usePurchases";

const unitId = __DEV__
  ? TestIds.ADAPTIVE_BANNER
  : "ca-app-pub-6230290323057717/6085287882";

function useAds() {
  const state = useSyncExternalStore(ads.subscribe, ads.getState, ads.getState);
  useEffect(() => {
    void ads.prepare();
  }, []);
  return state;
}

export const AdBanner = memo(function AdBanner() {
  const { loaded, owned } = usePurchases();
  if (!loaded || owned) return null;
  return <EligibleBanner />;
});

function EligibleBanner() {
  const { ready } = useAds();
  const [width, setWidth] = useState(0);
  return (
    <View
      style={styles.slot}
      onLayout={(event) => setWidth(Math.floor(event.nativeEvent.layout.width))}
    >
      <Label>ADVERTISEMENT</Label>
      <View style={styles.creative}>
        {ready && width > 0 && (
          <BannerAd
            key={width}
            unitId={unitId}
            size={BannerAdSize.INLINE_ADAPTIVE_BANNER}
            width={width}
            maxHeight={100}
          />
        )}
      </View>
    </View>
  );
}

export function AdPrivacyOptions() {
  const { privacyRequired } = useAds();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!privacyRequired) return null;
  return (
    <>
      <Button
        title="Ad privacy choices"
        disabled={busy}
        onPress={() => {
          setBusy(true);
          setError("");
          void ads
            .showPrivacyOptions()
            .catch(() => {
              setError("Ad privacy choices could not open. Please try again.");
            })
            .finally(() => setBusy(false));
        }}
      />
      {error !== "" && <Body>{error}</Body>}
    </>
  );
}

const styles = StyleSheet.create({
  slot: { alignSelf: "stretch", gap: 8, marginVertical: 16 },
  creative: { height: 100, alignItems: "center", justifyContent: "center" },
});
