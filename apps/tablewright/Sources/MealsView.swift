import SwiftUI

struct MealsView: View {
    @EnvironmentObject private var store: Store
    @State private var path: [Meal] = []
    @State private var adding = false

    var body: some View {
        NavigationStack(path: $path) {
            List {
                if store.book.meals.isEmpty {
                    Text("Your dishes live here. Tap + to add one with what goes in it; its ingredients go on the grocery list in every week you plan it.")
                        .foregroundStyle(.secondary)
                }
                ForEach(store.sortedMeals) { meal in
                    NavigationLink(value: meal) {
                        VStack(alignment: .leading, spacing: 2) {
                            Text(meal.name)
                            Text(store.summary(of: meal))
                                .font(.caption)
                                .foregroundStyle(.secondary)
                                .lineLimit(1)
                        }
                    }
                }
                .onDelete { offsets in
                    let meals = store.sortedMeals
                    offsets.map { meals[$0] }.forEach(store.remove)
                }
            }
            .navigationTitle("Dishes")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { adding = true } label: { Image(systemName: "plus") }
                        .accessibilityLabel("Add a dish")
                }
            }
            .navigationDestination(for: Meal.self) { meal in
                MealView(meal: meal)
            }
            .sheet(isPresented: $adding) {
                MealForm(title: "New dish", meal: Meal(name: "", ingredients: [], note: "")) { store.add($0) }
            }
            .task {
                if DebugLaunch.shot == 4, let meal = store.sortedMeals.first(where: { $0.ingredients.count > 4 }) {
                    path = [meal]
                }
            }
        }
    }
}

struct MealView: View {
    let meal: Meal
    @EnvironmentObject private var store: Store
    @Environment(\.dismiss) private var dismiss
    @State private var editing = false

    private var current: Meal { store.meal(meal.id) ?? meal }

    var body: some View {
        List {
            Section("Ingredients") {
                if current.ingredients.isEmpty {
                    Text("None yet. Tap Edit to add what goes in it.")
                        .foregroundStyle(.secondary)
                }
                ForEach(current.ingredients.indices, id: \.self) { index in
                    Label(current.ingredients[index], systemImage: "leaf")
                }
            }
            if !current.note.isEmpty {
                Section("Notes") {
                    Text(current.note)
                }
            }
            Section {
                LabeledContent("Planned this week", value: store.timesThisWeek(current).formatted())
                Button("Remove dish", role: .destructive) {
                    store.remove(current)
                    dismiss()
                }
            } footer: {
                Text("Removing a dish also takes it off every day it was planned.")
            }
        }
        .navigationTitle(current.name)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) { Button("Edit") { editing = true } }
        }
        .sheet(isPresented: $editing) {
            MealForm(title: "Edit dish", meal: current) { store.update($0) }
        }
    }
}

struct MealForm: View {
    let title: String
    @State private var meal: Meal
    @State private var ingredientsText: String
    var onSave: (Meal) -> Void
    @Environment(\.dismiss) private var dismiss

    init(title: String, meal: Meal, onSave: @escaping (Meal) -> Void) {
        self.title = title
        _meal = State(initialValue: meal)
        _ingredientsText = State(initialValue: meal.ingredients.joined(separator: "\n"))
        self.onSave = onSave
    }

    private var trimmedName: String { meal.name.trimmingCharacters(in: .whitespaces) }

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Name of the dish", text: $meal.name)
                }
                Section {
                    TextField("One ingredient per line", text: $ingredientsText, axis: .vertical)
                        .lineLimit(4...12)
                } header: {
                    Text("Ingredients")
                } footer: {
                    Text("Each goes on the grocery list in the weeks you plan this dish.")
                }
                Section("Notes") {
                    TextField("Where the recipe is, how long it takes", text: $meal.note, axis: .vertical)
                        .lineLimit(2...6)
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        var saved = meal
                        saved.name = trimmedName
                        saved.ingredients = ingredientsText
                            .split(whereSeparator: { $0.isNewline })
                            .map { String($0).trimmingCharacters(in: .whitespaces) }
                            .filter { !$0.isEmpty }
                        onSave(saved)
                        dismiss()
                    }
                    .disabled(trimmedName.isEmpty)
                }
            }
        }
    }
}
