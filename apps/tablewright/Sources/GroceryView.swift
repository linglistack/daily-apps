import SwiftUI

struct GroceryView: View {
    @EnvironmentObject private var store: Store
    @State private var newItem = ""

    private var trimmed: String { newItem.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    if store.groceries.isEmpty {
                        Text("Plan dishes that have ingredients on the Week tab, and what they need shows up here.")
                            .foregroundStyle(.secondary)
                    }
                    ForEach(store.groceries) { line in
                        let checked = store.isChecked(line)
                        Button { store.toggle(line) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: checked ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(.tint)
                                Text(line.name)
                                    .strikethrough(checked)
                                    .foregroundStyle(checked ? Color.secondary : Color.primary)
                                Spacer()
                                if line.count > 1 {
                                    Text("for \(line.count) meals")
                                        .font(.caption)
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(line.name), \(checked ? "ticked" : "not ticked")")
                    }
                } header: {
                    Text("For \(store.weekTitle)")
                } footer: {
                    if !store.groceries.isEmpty {
                        Text("Tap an item when it is in the basket.")
                    }
                }
                Section("Also need") {
                    ForEach(store.book.extras) { extra in
                        Button { store.toggle(extra) } label: {
                            HStack(spacing: 12) {
                                Image(systemName: extra.done ? "checkmark.circle.fill" : "circle")
                                    .foregroundStyle(.tint)
                                Text(extra.name)
                                    .strikethrough(extra.done)
                                    .foregroundStyle(extra.done ? Color.secondary : Color.primary)
                                Spacer()
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("\(extra.name), \(extra.done ? "ticked" : "not ticked")")
                    }
                    .onDelete { offsets in
                        offsets.map { store.book.extras[$0] }.forEach(store.removeExtra)
                    }
                    HStack {
                        TextField("Something else to buy", text: $newItem)
                            .onSubmit { addItem() }
                        Button("Add") { addItem() }
                            .buttonStyle(.borderless)
                            .disabled(trimmed.isEmpty)
                    }
                }
            }
            .navigationTitle("Groceries")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("New shop") { store.clearChecked() }
                        .disabled(!store.anyChecked)
                }
            }
        }
    }

    private func addItem() {
        guard !trimmed.isEmpty else { return }
        store.addExtra(trimmed)
        newItem = ""
    }
}
