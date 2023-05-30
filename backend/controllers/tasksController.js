const { Tasks, Users, TaskUser } = require('../models/models');
const ApiError = require('../error/ApiError');
const uuid = require('uuid');
const path = require('path');
const cron = require('node-cron');
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'savelyev_av@edu.surgu.ru',
        pass: 'plbhwtubkzdlwluc'
    }
});

function sendEmail(task_id = undefined, to_exp = 'sutula05@bk.ru') {
    const mailOptions = {
        from: 'savelyev_av@edu.surgu.ru',
        to: to_exp,
        subject: 'Привет',
        text: `Вам необходимо поставить рейтинг по такой ссылке https://host.com/rating?taskId=${task_id}`
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log(`Email sent: ${info.response}`);
            schedule.stop();
        }
    });
}

class TasksController {



    async create(req, res, next) {
        try {
            const { name, description, typ, userId, stop } = req.body;
            const isExists = await Tasks.findOne({ where: { name } });

            if (isExists) {
                return next(ApiError.badRequest('Проект с таким именем уже существует'));
            }

            const task = await Tasks.create({ name, description, typ, stop }, { returning: true });
            const user = await Users.findAll({ where: { id: userId } });
            await task.addUser(user);
            let d = new Date(stop)
            console.log(d.getMonth() + 1)
            console.log(d.getDate())

            const experts = await Users.findAll({ where: { role: 'EXPERT' } });


            try{
            for(let i of experts){

            const schedule = cron.schedule(`59 11 5 ${d.getDate()} ${d.getMonth() + 1} *`, () => {
                sendEmail(task.id, i.email)
            });
            schedule.start();
            
            }

            return res.json('Проект успешно создан');
        }catch{

            return res.json('Не найдены эксперты');

        }


        } catch (error) {
            return next(ApiError.internal('Ошибка создания задачи', error));
        }
    }


    async getAll(req, res) {


        let { limit, page } = req.query;
        page = page || 1;
        limit = limit || 8;
        let offset = page * limit - limit;
        const tasks = await Tasks.findAndCountAll({
            limit: limit,
            offset: offset,
            distinct: true,
            include: [{
                model: Users,
                as: 'users',
                required: false,
                attributes: ['id', 'name'],
                through: { attributes: ['predicted', 'rate'] }
            }],
        });

        return res.json(tasks)

    }

    async getOne(req, res) {
        let { taskId } = req.query;
        const task = await Tasks.findOne({
            where: { id: taskId },
            distinct: true,
            include: [{
                model: Users,
                as: 'users',
                required: false,
                attributes: ['id', 'name'],
                through: { attributes: ['predicted', 'rate'] }
            }],
        });

        return res.json(task)

    }



    async add_user(req, res) {
        let { userId, contentId, predict } = req.body;

        const user = await Users.findOne({ where: { id: userId } });
        const task = await Tasks.findOne({ where: { id: contentId } });

        if (user && task) {
            task.addUsers(user, { through: { predicted: predict } })
            return res.json(task) //Вместо ответа сделай на подобии ApiError только ApiSuccess.GoodRequest('Пользователь успешно добавлен')
        } else {
            return next(ApiError.badRequest('Такого пользователя или проекта не существует'))
        }

    }

    async createRate(req, res) {
        let { userId, taskId, rate } = req.body;
        const task1 = await Tasks.findByPk(taskId)

        if (!task1) {
            return res.json('task не найден в БД')
        }
        const user1 = await Users.findByPk(userId)
        if (!user1) {
            return res.json('User не найден в БД')
        }
        const user = await Users.findOne({ where: { id: userId } });
        const task = await Tasks.findOne({ where: { id: taskId } });

        if (user && task) {


            const taskUser = await TaskUser.findOne({ where: { userId: userId, TasksId: taskId } }) //из вот этой функи достаем это -> {rates: 0, votes: 0, rating: 0}


            let obja = JSON.parse(JSON.stringify(taskUser.rate));
            obja.rates = +obja.rates + rate;
            obja.votes = +obja.votes + 1;
            obja.rating = +obja.rates / +obja.votes;

            const a = await TaskUser.update({ rate: obja }, {
                where: {

                    userId: userId,
                    TasksId: taskId

                }
            });
            //task.addUsers(user, { through: { predicted: predict } })
            return res.json(task) //Вместо ответа сделай на подобии ApiError только ApiSuccess.GoodRequest('Пользователь успешно добавлен')



        } else {
            return next(ApiError.badRequest('Такого пользователя или проекта не существует'))

        }


    }

    async getUserTasks(req, res) {
        let { userId, page, limit, type } = req.query;
        page = page || 1;
        limit = limit || 8;
        let offset = page * limit - limit;
        // получаем пользователя
        const user = await Users.findOne({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('Такого пользователя не существует');
        }
        if (type !== undefined) {
            const count = await user.countTasks({ where: { typ: type } });
            const userTasks = await user.getTasks({
                where: { typ: type },
                limit: limit,
                offset: offset,
                distinct: true,
                include: [{
                    model: Users,
                    as: 'users',
                    required: false,
                    attributes: ['id', 'name', 'email'],
                    through: { attributes: ['predicted', 'rate'] }
                }],
            });
            return res.json({
                count: count,
                rows: userTasks
            });
        } else {
            const count = await user.countTasks();
            const userTasks = await user.getTasks({
                limit: limit,
                offset: offset,
                distinct: true,
                include: [{
                    model: Users,
                    as: 'users',
                    required: false,
                    attributes: ['id', 'name', 'email'],
                    through: { attributes: ['predicted', 'rate'] }
                }],
            });
            const commitment = userTasks.map((item) => {
                return (
                    {
                        "item": item.name,
                        "user": "Обязательства",
                        "score": item.TaskUser.predicted
                    }
                )
            })
            const execution = userTasks.map((item) => {
                return (
                    {
                        "item": item.name,
                        "user": "Фактическое исполнение",
                        "score": item.TaskUser.rate.rating
                    }
                )
            })
            const result = [...commitment, ...execution]
            return res.json(result);
        }


    }

    async getStatsTasks(req, res) {



        const tasks = await Tasks.findAll({
            distinct: true,
            include: [{
                model: Users,
                as: 'users',
                required: false,
                attributes: ['id', 'name'],
                through: { attributes: ['predicted', 'rate'] }
            }],
        });
        let result = [];

        tasks.forEach((task, i) => {
            const commitment = task.users.map((item) => {
                return {
                    "item": task.name,
                    "user": `[План] ${item.name}`,
                    "score": item.TaskUser.predicted,
                };
            });
            const execution = task.users.map((item) => {
                return {
                    "item": task.name,
                    "user": `[Факт] ${item.name}`,
                    "score": item.TaskUser.rate.rating,
                };
            });
            result.push(...commitment, ...execution);
        });
        return res.json(result);



    }
}
//сразу указывает сколько сделает
//админ только создает задачу, а юзеры сами выбирают сколько сделают в цифрах
module.exports = new TasksController()