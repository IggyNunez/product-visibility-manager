import { useState } from "react";
import { Page, Layout, Card, FormLayout, TextField, Button, Frame, Toast } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useFetcher } from "@remix-run/react";

export default function Settings() {
  const fetcher = useFetcher();
  const [settings, setSettings] = useState({
    message: "VIP Members Only",
    buttonText: "Get VIP Access",
    buttonUrl: "/pages/vip-membership",
    blurAmount: "8",
    overlayBg: "#ffffff",
    buttonBg: "#000000"
  });
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    fetcher.submit(settings, { method: "POST" });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <Frame>
      <Page>
        <TitleBar title="Visibility Settings" />
        <Layout>
          <Layout.Section>
            <Card>
              <Card.Section>
                <FormLayout>
                  <TextField
                    label="Overlay Message"
                    value={settings.message}
                    onChange={(value) => setSettings({...settings, message: value})}
                  />
                  <TextField
                    label="Button Text"
                    value={settings.buttonText}
                    onChange={(value) => setSettings({...settings, buttonText: value})}
                  />
                  <TextField
                    label="Button URL"
                    value={settings.buttonUrl}
                    onChange={(value) => setSettings({...settings, buttonUrl: value})}
                  />
                  <TextField
                    label="Blur Amount"
                    type="number"
                    value={settings.blurAmount}
                    onChange={(value) => setSettings({...settings, blurAmount: value})}
                  />
                  <Button primary onClick={handleSave}>Save Settings</Button>
                </FormLayout>
              </Card.Section>
            </Card>
          </Layout.Section>
        </Layout>
        {saved && <Toast content="Settings saved" />}
      </Page>
    </Frame>
  );
}