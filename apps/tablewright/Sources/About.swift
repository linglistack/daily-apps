import SwiftUI

/// The way to the privacy policy and to support, which Apple asks every app to carry inside it.
/// The page's address and the email are written into the app when it is built, from
/// ops/factory.json, so no file here holds them. Every app keeps this file as it is and puts
/// `AboutButton()` in the toolbar of its main screen.
struct AboutButton: View {
    @State private var showing = false

    var body: some View {
        Button { showing = true } label: { Image(systemName: "info.circle") }
            .accessibilityLabel("About, privacy and support")
            .sheet(isPresented: $showing) { AboutView() }
    }
}

struct AboutView: View {
    @Environment(\.dismiss) private var dismiss

    private func info(_ key: String) -> String? {
        Bundle.main.object(forInfoDictionaryKey: key) as? String
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if let address = info("AboutPage"), let page = URL(string: address) {
                        Link("Privacy and support", destination: page)
                    }
                    if let email = info("AboutEmail") {
                        LabeledContent("Email", value: email)
                            .textSelection(.enabled)
                    }
                } footer: {
                    Text("Everything you enter stays on this iPhone. This app has no account and collects nothing.")
                }
                Section {
                    LabeledContent("Version", value: info("CFBundleShortVersionString") ?? "1.0")
                }
            }
            .navigationTitle("About")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) { Button("Done") { dismiss() } }
            }
        }
    }
}
