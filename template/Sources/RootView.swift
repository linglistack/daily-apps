import SwiftUI

struct RootView: View {
    @EnvironmentObject private var store: Store
    @State private var path: [Entry] = []
    @State private var adding = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                Section {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Total")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                        Text(store.total.formatted(.number.precision(.fractionLength(1))))
                            .font(.system(size: 44, weight: .bold, design: .rounded))
                    }
                    .padding(.vertical, 6)
                    .accessibilityElement(children: .combine)
                }
                Section("Entries") {
                    if store.entries.isEmpty {
                        Text("Nothing yet. Tap + to add the first one.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.entries) { entry in
                        NavigationLink(value: entry) {
                            HStack {
                                VStack(alignment: .leading, spacing: 2) {
                                    Text(entry.title)
                                    Text(entry.date.formatted(date: .abbreviated, time: .omitted))
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Text(entry.amount.formatted(.number.precision(.fractionLength(1))))
                                    .font(.system(.body, design: .rounded).weight(.semibold))
                            }
                        }
                    }
                    .onDelete { offsets in
                        offsets.map { store.entries[$0] }.forEach(store.remove)
                    }
                }
            }
            .navigationTitle("Starter")
            .toolbar {
                ToolbarItem(placement: .topBarLeading) { AboutButton() }
                ToolbarItem(placement: .topBarTrailing) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Add an entry")
                }
            }
            .navigationDestination(for: Entry.self) { entry in
                EntryView(entry: entry)
            }
            .sheet(isPresented: $adding) {
                EntryForm(title: "New entry", entry: Entry(title: "", amount: 0, date: .now)) { store.add($0) }
            }
            .task {
                // Each screenshot opens a different screen: 1 is this list as it stands.
                if DebugLaunch.shot == 2 { adding = true }
                if DebugLaunch.shot == 3, let first = store.entries.first { path = [first] }
            }
        }
    }
}

struct EntryView: View {
    let entry: Entry
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false

    private var current: Entry { store.entries.first { $0.id == entry.id } ?? entry }

    var body: some View {
        List {
            LabeledContent("Amount", value: current.amount.formatted(.number.precision(.fractionLength(1))))
            LabeledContent("Date", value: current.date.formatted(date: .long, time: .omitted))
            Button("Remove", role: .destructive) {
                store.remove(current)
                dismiss()
            }
        }
        .navigationTitle(current.title)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Edit") { editing = true } }
        }
        .sheet(isPresented: $editing) {
            EntryForm(title: "Edit entry", entry: current) { store.update($0) }
        }
    }
}

struct EntryForm: View {
    let title: String
    @State var entry: Entry
    var onSave: (Entry) -> Void
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                TextField("What was it?", text: $entry.title)
                TextField("Amount", value: $entry.amount, format: .number)
                    .keyboardType(.decimalPad)
                DatePicker("Date", selection: $entry.date, displayedComponents: .date)
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(entry)
                        dismiss()
                    }
                    .disabled(entry.title.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
    }
}
