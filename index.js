const env = require('dotenv')
env.config()
const { Telegraf } = require('telegraf')
const express = require('express')
const expressApp = express()
const { Markup } = Telegraf
const bot = new Telegraf(process.env.BOT_TOKEN)
const cheerio = require('cheerio');
const axios = require('axios').default;
let recipesRes = [];

const port = process.env.PORT || 3000
expressApp.get('/', (req, res) => {
  res.send('Hello my friend!')
})
expressApp.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

bot.start((ctx) => ctx.reply('Бот для нахождения рецептов для вас'))
bot.help((ctx) => ctx.reply('Send me a sticker'))
bot.on('sticker', (ctx) => ctx.reply('👍'))
bot.hears('hi', (ctx) => ctx.reply('Hey there'))

bot.on('message', async ctx => {
    let recipes = await getRecipes(ctx.message.text)
    const $ = cheerio.load(recipes.data);
    recipesRes.push(...$(".clearfix").map(function (i, recipe) {
        const url = 'http://eda.ru' + $(this).find(".horizontal-tile__item-title a").attr('href');
        return {
            id: `${Date.now()}${i}`,
            url,
            title: $(this).find(".lazy-load-container").attr('data-title').trim(),
            igredientsCount: $(this).find(".horizontal-tile__item-specifications div.inline-dropdown").text().trim(),
            portionsCounter: $(this).find(".portions-counter").text().trim(),
            prepTime: $(this).find(".prep-time").text().trim() !== '' ? $(this).find(".prep-time").text().trim() : 'N/A',
            imgUrl: $(this).find(".lazy-load-container").attr('data-src').trim(),
            ingredients: $(this).find(".ingredients-list__content-item").map(function(item) {
                return {
                    name: JSON.parse($(this).attr('data-ingredient-object')).name,
                    amount: JSON.parse($(this).attr('data-ingredient-object')).amount
                }
            }).get()
        }
    }).get())

    recipesRes.forEach(rec => {
        const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
                    [Markup.callbackButton('Ингредиенты', `ingredients-${rec.id}`)],
                    [Markup.callbackButton('Способ приготовления', `cooking-${rec.id}`)]
                ]).extra()
        ctx.replyWithMarkdown(createReply(rec), {
            reply_markup: inlineMessageRatingKeyboard.reply_markup
        })
    });
})

async function getRecipes(query) {
    const recipes = await axios.get('https://eda.ru/recipesearch', {
        params: {
          q: query,
          onlyEdaChecked: false
        }
    })
    return recipes
}

function createReply(rec) {
    let replyMessage = ''
    replyMessage += `${rec.title}\nВремя приготовления ${rec.prepTime}\n${rec.portionsCounter}\n${rec.igredientsCount}`
    return replyMessage + `[ ](${rec.imgUrl.replace('c285x285i', 'c400x400i')})`
}

function getIngredients(rec) {
    let ingredients = ''
    rec.ingredients.forEach(ingr => {
        ingredients += `${ingr.name} - ${ingr.amount}\n`
    })
    return `${rec.title}\n-Игредиенты\n${ingredients}` + `[ ](${rec.imgUrl.replace('c285x285i', 'c400x400i')})`
}

async function getCooking(rec) {
    const recipe = await axios.get(rec.url)
    const $ = cheerio.load(recipe.data)
    let howCook = $(".instruction").map(function (i, recipe) {
        return `${$(this).find('.instruction__description').text().trim()}`
    }).get()
    return `${rec.title}\n${howCook.join(`\n`)}` + `[ ](${rec.imgUrl.replace('c285x285i', 'c400x400i')})`
}

function handleActionIngredients (callbackData) {
    return callbackData.includes('ingredients')
}
function handleActionCooking (callbackData) {
    return callbackData.includes('cooking')
}
function handleActionBack (callbackData) {
    return callbackData.includes('back')
}

bot.action(handleActionIngredients, ctx => {
    let id = Number(ctx.update.callback_query.data.match(/\d+/g)[0])
    ctx.editMessageText(getIngredients(recipesRes.find(recipe => recipe.id == id)), {
        reply_markup: {
            inline_keyboard: [
                [
                  Markup.callbackButton('Назад', `back-${id}`)
                ]
              ]
        },
        parse_mode: 'Markdown'
      })
})
bot.action(handleActionCooking, async ctx => {
    let id = Number(ctx.update.callback_query.data.match(/\d+/g)[0])
    ctx.editMessageText(await getCooking(recipesRes.find(recipe => recipe.id == id)), {
        reply_markup: {
            inline_keyboard: [
                [
                  Markup.callbackButton('Назад', `back-${id}`)
                ]
              ]
        },
        parse_mode: 'Markdown'
      })
})
bot.action(handleActionBack, ctx => {
    let id = Number(ctx.update.callback_query.data.match(/\d+/g)[0])
    const inlineMessageRatingKeyboard = Markup.inlineKeyboard([
        [Markup.callbackButton('Ингредиенты', `ingredients-${id}`)],
        [Markup.callbackButton('Способ приготовления', `cooking-${id}`)]
    ]).extra()
    ctx.editMessageText(createReply(recipesRes.find(recipe => recipe.id == id)), {
        reply_markup: inlineMessageRatingKeyboard.reply_markup,
        parse_mode: 'Markdown'
    })
})

bot.launch()