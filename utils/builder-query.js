const _ = require("lodash")
const operatorMap = require("./common").operatorMap

module.exports = (context, params, mainTable) => {
  if (params) {
    let firstWhere = true
    for (let prop in params) {
      let objFilter = params[prop]
      for (let idx in objFilter) {
        let field, key, value
        let obj = objFilter[idx]
        key = Object.keys(objFilter)[0]

        let tbName, clName
        if (operatorMap[key]) {
          value = obj
          field = mainTable ? `${mainTable}.${prop}` : `${prop}`
          tbName = mainTable || null
          clName = prop
        } else {
          key = Object.keys(obj)[0]
          field = `${prop}.${idx}`
          value = obj[key]
          tbName = prop
          clName = idx
        }
        switch (key) {
          case "neq": {
            context.whereRaw(`${field} is distinct from ?`, [value])
            break
          }
          case "gt":
          case "lt":
          case "eq":
          case "gte":
          case "lte":
          case "like":
            if (field.indexOf(".")) {
              field = `"${tbName}"."${clName}"`
            }
            if (_.isArray(value)) {
              value.map((val, idx) => {
                const conditionValue = key === "like" ? `%${val}%` : val
                if (firstWhere === true && idx === 0) {
                  context.whereRaw(`${field} ${operatorMap[key]} :value`, { value: conditionValue })
                } else {
                  context.andWhereRaw(`${field} ${operatorMap[key]} :value`, { value: conditionValue })
                }
              })
            } else {
              // explicit typecasting for the invoice amount (necessary to compare float with ilike)
              if (_.includes(["amount", "price"], clName) && key === "like") {
                context.whereRaw(`cast (${field} as text) ${operatorMap[key]} :value`, {
                  value: `%${value.replace(/\./g, "").replace(/,/g, ".")}%`
                })
              } else {
                const conditionValue = key === "like" ? `%${value}%` : value
                context.whereRaw(`${field} ${operatorMap[key]} :value`, { value: conditionValue })
              }
            }
            break
          case "between":
          case "notbetween":
            // console.log('between for', prop, obj[key])
            if (Array.isArray(value) && value.length === 2) {
              let and = firstWhere ? "where" : "andWhere"
              let not = key === "notbetween" ? "Not" : ""
              context[`${and}${not}Between`](field, value)
            } else {
              throw new Error(`The ${key} filter needs two arguments`)
            }
            break
          case "in":
            context.where(field, operatorMap[key], value)
            break
          case "jHK":
            {
              if (field.indexOf(".")) {
                field = `"${tbName}"."${clName}"`
              }
              context.whereRaw(`${field} -> ? > ?`, [value, "1"])
            }
            break
          default:
            throw new Error(`${key} is not a valid operator`)
        }
      }
    }
  }
}
