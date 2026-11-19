package com.siquotespro.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.util.Base64;
import android.util.Base64InputStream;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "NativeDocuments")
public class NativeDocumentsPlugin extends Plugin {
    @PluginMethod
    public void print(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            PrintManager manager = (PrintManager) getContext().getSystemService(Context.PRINT_SERVICE);
            if (manager == null) {
                call.reject("Printing is unavailable on this device.");
                return;
            }
            String title = call.getString("title", "S-I-Quotespro");
            manager.print(title, getBridge().getWebView().createPrintDocumentAdapter(title),
                    new PrintAttributes.Builder().build());
            call.resolve();
        });
    }

    @PluginMethod
    public void save(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.length() > 40000000) {
            call.reject("The document is missing or too large to export.");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "application/pdf"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "Quote.pdf"));
        startActivityForResult(call, intent, "fileCreated");
    }

    @ActivityCallback
    private void fileCreated(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("Export cancelled.", "USER_CANCELLED");
            return;
        }
        Uri uri = result.getData().getData();
        if (uri == null) {
            call.reject("No file destination was selected.");
            return;
        }
        getBridge().execute(() -> {
            try (InputStream input = new Base64InputStream(
                    new ByteArrayInputStream(call.getString("data", "").getBytes(StandardCharsets.US_ASCII)),
                    Base64.DEFAULT);
                 OutputStream output = getContext().getContentResolver().openOutputStream(uri, "w")) {
                if (output == null) throw new IllegalStateException("The selected destination is unavailable.");
                byte[] buffer = new byte[16384];
                int count;
                while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
                call.resolve();
            } catch (Exception error) {
                call.reject("The document could not be saved.", error);
            }
        });
    }

    @Override
    public Boolean shouldOverrideLoad(Uri url) {
        // The bridge stays on packaged assets. Product account upgrades and
        // marketing pages are outside the Play app's consumption-only flow.
        String host = url.getHost();
        if ("www.s-i-quotespro.com".equals(host) || "s-i-quotespro.com".equals(host)
                || "checkout.stripe.com".equals(host) || "billing.stripe.com".equals(host)) {
            return true;
        }
        return null;
    }
}
